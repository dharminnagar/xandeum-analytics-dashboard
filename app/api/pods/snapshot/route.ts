import { NextResponse } from "next/server";
import { APINodesWithStatsResponse } from "@/types/nodes";
import { upsertPod } from "@/lib/db/queries/pods";
import prisma from "@/lib/db/prisma";
import { ipGeolocationService } from "@/lib/ip-geolocation.service";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const logs: string[] = [];
  logs.push("Pods Snapshot API: Starting request");

  // Check authentication
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.SNAPSHOT_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "SNAPSHOT_SECRET not configured", logs },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    logs.push("Authentication failed");
    return NextResponse.json({ error: "Unauthorized", logs }, { status: 401 });
  }

  logs.push("Authentication successful");

  try {
    // Call the existing /api/pods endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    logs.push(`Fetching from: ${baseUrl}/api/pods`);

    const response = await fetch(`${baseUrl}/api/pods`, {
      method: "POST",
      cache: "no-store",
    });

    logs.push(`Response status: ${response.status}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pods data", logs },
        { status: response.status }
      );
    }

    const data: APINodesWithStatsResponse = await response.json();
    logs.push(`Received ${data.stats?.result?.pods?.length || 0} pods`);

    // Check if we have valid data
    if (!data.stats || !data.stats.result || !data.stats.result.pods) {
      console.error("Invalid response structure:", data);
      return NextResponse.json({ ...data, logs });
    }

    // Save all pods and their metrics to database
    logs.push(
      `Attempting to save ${data.stats.result.pods.length} pods to database`
    );
    try {
      let savedCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;
      const errors: string[] = [];

      // Get all current addresses from API
      const apiAddresses = new Set(
        data.stats.result.pods.map((pod) => pod.address)
      );

      // Get all pods from database with their latest metrics in ONE query
      const dbPods = await prisma.pod.findMany({
        select: {
          id: true,
          address: true,
          pubkey: true,
          version: true,
          isPublic: true,
          metrics: {
            orderBy: { timestamp: "desc" },
            take: 1,
            select: {
              storageUsed: true,
              storageCommitted: true,
              storageUsagePercent: true,
              uptime: true,
              timestamp: true,
            },
          },
        },
      });

      const dbPodMap = new Map(dbPods.map((p) => [p.address, p]));

      // Find pods in DB but not in API (offline/old pods)
      const podsToDelete = dbPods.filter(
        (pod) => !apiAddresses.has(pod.address)
      );

      // Delete offline pods in batch
      if (podsToDelete.length > 0) {
        logs.push(`Deleting ${podsToDelete.length} offline pods`);
        await prisma.pod.deleteMany({
          where: { id: { in: podsToDelete.map((p) => p.id) } },
        });
        deletedCount = podsToDelete.length;
      }

      // Process each pod with change detection
      const podsToUpsert: typeof data.stats.result.pods = [];
      const metricsToInsert: Array<{
        podAddress: string;
        pod: (typeof data.stats.result.pods)[0];
      }> = [];

      for (const pod of data.stats.result.pods) {
        try {
          const existingPod = dbPodMap.get(pod.address);
          const latestMetrics = existingPod?.metrics[0];

          // Check if metrics actually changed
          const metricsChanged =
            !latestMetrics ||
            latestMetrics.storageUsed?.toString() !==
              pod.storage_used?.toString() ||
            latestMetrics.storageCommitted?.toString() !==
              pod.storage_committed?.toString() ||
            latestMetrics.storageUsagePercent !== pod.storage_usage_percent ||
            latestMetrics.uptime !== pod.uptime;

          // Check if pod metadata changed
          const metadataChanged =
            !existingPod ||
            existingPod.pubkey !== (pod.pubkey ?? null) ||
            existingPod.version !== pod.version ||
            existingPod.isPublic !== pod.is_public;

          // Track what needs updating
          if (metadataChanged) {
            podsToUpsert.push(pod);
          }

          if (metricsChanged) {
            metricsToInsert.push({ podAddress: pod.address, pod });
          }

          if (metadataChanged || metricsChanged) {
            savedCount++;
          } else {
            skippedCount++;
          }
        } catch (podError) {
          const errorMsg = `Failed to process pod ${pod.pubkey || pod.address}: ${podError instanceof Error ? podError.message : String(podError)}`;
          errors.push(errorMsg);
        }
      }

      // Batch upsert pods with metadata changes
      if (podsToUpsert.length > 0) {
        logs.push(
          `Upserting ${podsToUpsert.length} pods with metadata changes`
        );
        for (const pod of podsToUpsert) {
          try {
            await upsertPod(pod);
          } catch (podError) {
            const errorMsg = `Failed to upsert pod ${pod.pubkey || pod.address}: ${podError instanceof Error ? podError.message : String(podError)}`;
            errors.push(errorMsg);
          }
        }
      }

      // Batch insert metrics (need pod IDs first)
      if (metricsToInsert.length > 0) {
        logs.push(`Inserting ${metricsToInsert.length} new metrics records`);

        // Get pod IDs for all addresses
        const podIds = await prisma.pod.findMany({
          where: {
            address: { in: metricsToInsert.map((m) => m.podAddress) },
          },
          select: { id: true, address: true },
        });

        const addressToPodId = new Map(podIds.map((p) => [p.address, p.id]));

        // Batch insert all metrics
        const metricsData = metricsToInsert
          .map((m) => {
            const podId = addressToPodId.get(m.podAddress);
            if (!podId) return null;

            return {
              podId,
              timestamp: new Date(m.pod.last_seen_timestamp * 1000),
              storageUsed: m.pod.storage_used
                ? BigInt(m.pod.storage_used)
                : null,
              storageCommitted: m.pod.storage_committed
                ? BigInt(m.pod.storage_committed)
                : null,
              storageUsagePercent: m.pod.storage_usage_percent,
              uptime: m.pod.uptime,
              lastSeenTimestamp: BigInt(m.pod.last_seen_timestamp),
            };
          })
          .filter((m) => m !== null);

        if (metricsData.length > 0) {
          await prisma.podMetricsHistory.createMany({
            data: metricsData,
            skipDuplicates: true,
          });
        }
      }

      logs.push(
        `Processed ${data.stats.result.pods.length} pods: ${savedCount} saved, ${skippedCount} skipped (no changes), ${deletedCount} deleted`
      );

      // Only process geolocation if we have new pods (non-blocking)
      let geoResult = {
        newIpsCount: 0,
        storedCount: 0,
        batchesProcessed: 0,
      };

      if (savedCount > 0) {
        try {
          const podAddresses = data.stats.result.pods.map((pod) => pod.address);
          geoResult = await ipGeolocationService.processNewIps(podAddresses);

          if (geoResult.storedCount > 0) {
            logs.push(
              `Stored new IP geolocation data: ${geoResult.storedCount} new locations`
            );
          }
        } catch (geoError) {
          logs.push(
            `Geolocation processing failed (non-critical): ${geoError instanceof Error ? geoError.message : String(geoError)}`
          );
        }
      } else {
        logs.push("Skipped geolocation processing (no new pods)");
      }

      return NextResponse.json({
        ...data,
        dbSave: {
          savedCount,
          skippedCount,
          deletedCount,
          errors,
          logs,
          geolocation: {
            newIps: geoResult.newIpsCount,
            stored: geoResult.storedCount,
            batchesProcessed: geoResult.batchesProcessed,
          },
        },
      });
    } catch (dbError) {
      const errorMsg = `Failed to save pods: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
      logs.push(errorMsg);
      return NextResponse.json({ ...data, dbSave: { error: errorMsg, logs } });
    }
  } catch (e) {
    logs.push(`Error: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json(
      {
        error: "SERVER FAILED",
        msg: e instanceof Error ? e.message : String(e),
        logs,
      },
      { status: 500 }
    );
  }
}
