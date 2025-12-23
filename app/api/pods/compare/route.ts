import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Pod, PodMetricsHistory } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const podsParam = searchParams.get("pods"); // Comma-separated pubkeys or addresses

    if (!podsParam) {
      return NextResponse.json(
        {
          error:
            "Missing 'pods' parameter. Provide comma-separated pubkeys or addresses.",
        },
        { status: 400 }
      );
    }

    const podIdentifiers = podsParam.split(",").map((s) => s.trim());

    if (podIdentifiers.length < 2) {
      return NextResponse.json(
        { error: "At least 2 pods are required for comparison" },
        { status: 400 }
      );
    }

    if (podIdentifiers.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 pods can be compared at once" },
        { status: 400 }
      );
    }

    // Find pods by pubkey or address
    const pods = await prisma.pod.findMany({
      where: {
        OR: [
          { pubkey: { in: podIdentifiers } },
          { address: { in: podIdentifiers } },
        ],
      },
      include: {
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 10, // Last 10 data points for trend
        },
      },
    });

    type PodWithMetrics = Pod & { metrics: PodMetricsHistory[] };

    if (pods.length === 0) {
      return NextResponse.json(
        { error: "No pods found with the provided identifiers" },
        { status: 404 }
      );
    }

    // Format comparison data
    const comparison = pods.map((pod: PodWithMetrics) => {
      const latestMetric = pod.metrics[0];
      const metricsHistory = pod.metrics.map((m: PodMetricsHistory) => ({
        timestamp: m.timestamp.toISOString(),
        storageUsed: m.storageUsed?.toString() || "0",
        storageUsagePercent: m.storageUsagePercent?.toString() || "0",
        uptime: m.uptime || 0,
      }));

      return {
        pubkey: pod.pubkey,
        address: pod.address,
        isPublic: pod.isPublic,
        rpcPort: pod.rpcPort,
        current: latestMetric
          ? {
              version: pod.version,
              storageCommitted:
                latestMetric.storageCommitted?.toString() || "0",
              storageUsed: latestMetric.storageUsed?.toString() || "0",
              storageUsagePercent:
                latestMetric.storageUsagePercent?.toString() || "0",
              uptime: latestMetric.uptime || 0,
              lastSeen: latestMetric.timestamp.toISOString(),
            }
          : null,
        history: metricsHistory,
      };
    });

    // Calculate comparative statistics
    const stats = {
      totalPods: comparison.length,
      avgStorageCommitted:
        comparison.reduce(
          (sum: bigint, p) => sum + BigInt(p.current?.storageCommitted || "0"),
          BigInt(0)
        ) / BigInt(comparison.length),
      avgStorageUsed:
        comparison.reduce(
          (sum: bigint, p) => sum + BigInt(p.current?.storageUsed || "0"),
          BigInt(0)
        ) / BigInt(comparison.length),
      avgUptime:
        comparison.reduce(
          (sum: number, p) => sum + (p.current?.uptime || 0),
          0
        ) / comparison.length,
      publicCount: comparison.filter((p) => p.isPublic).length,
      versions: [
        ...new Set(comparison.map((p) => p.current?.version).filter(Boolean)),
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        pods: comparison,
        statistics: {
          ...stats,
          avgStorageCommitted: stats.avgStorageCommitted.toString(),
          avgStorageUsed: stats.avgStorageUsed.toString(),
        },
      },
    });
  } catch (error) {
    console.error("Error comparing pods:", error);
    return NextResponse.json(
      { error: "Failed to compare pods" },
      { status: 500 }
    );
  }
}
