import { NextResponse } from "next/server";
import { APINodesWithStatsResponse } from "@/types/nodes";
import { upsertPod, savePodMetrics } from "@/lib/db/queries/pods";
import prisma from "@/lib/db/prisma";

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
      let deletedCount = 0;
      const errors: string[] = [];

      // Get all current addresses from API
      const apiAddresses = new Set(
        data.stats.result.pods.map((pod) => pod.address)
      );

      // Get all addresses from database
      const dbPods = await prisma.pod.findMany({
        select: { id: true, address: true },
      });

      // Find pods in DB but not in API (offline/old pods)
      const podsToDelete = dbPods.filter(
        (pod) => !apiAddresses.has(pod.address)
      );

      // Delete offline pods
      if (podsToDelete.length > 0) {
        logs.push(`Deleting ${podsToDelete.length} offline pods`);
        for (const pod of podsToDelete) {
          await prisma.pod.delete({ where: { id: pod.id } });
          deletedCount++;
          logs.push(`Deleted offline pod: ${pod.address}`);
        }
      }

      // Upsert all current pods
      for (const pod of data.stats.result.pods) {
        try {
          // Upsert the pod
          const upsertedPod = await upsertPod(pod);
          logs.push(
            `Upserted pod ${upsertedPod.id}: ${pod.pubkey || pod.address}`
          );

          // Save metrics history
          await savePodMetrics(upsertedPod.id, pod);
          savedCount++;
        } catch (podError) {
          const errorMsg = `Failed to save pod ${pod.pubkey || pod.address}: ${podError instanceof Error ? podError.message : String(podError)}`;
          logs.push(errorMsg);
          errors.push(errorMsg);
        }
      }
      logs.push(
        `Successfully saved ${savedCount}/${data.stats.result.pods.length} pods to database`
      );
      logs.push(`Deleted ${deletedCount} offline pods`);

      return NextResponse.json({
        ...data,
        dbSave: { savedCount, deletedCount, errors, logs },
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
