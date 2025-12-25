import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") as "24h" | "7d" | "30d" | null;
    const { id } = await params;

    // Calculate time range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "24h":
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Find pods by pubkey or address
    const pods = await prisma.pod.findMany({
      where: {
        OR: [{ pubkey: id }, { address: id }],
      },
      include: {
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    if (pods.length === 0) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Get the pubkey (use first pod's pubkey or the id if it's a pubkey)
    const pubkey = pods[0].pubkey || id;

    // Get all pods with this pubkey
    const allPods = await prisma.pod.findMany({
      where: { pubkey },
      include: {
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Get historical metrics for all pods with this pubkey
    const podIds = allPods.map((p) => p.id);
    const historicalMetrics = await prisma.podMetricsHistory.findMany({
      where: {
        podId: { in: podIds },
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: "asc" },
    });

    // Group historical data by 5-minute intervals
    const intervalData: Record<
      string,
      {
        timestamp: string;
        storageUsed: bigint;
        storageCommitted: bigint;
        uptime: number;
        count: number;
      }
    > = {};

    historicalMetrics.forEach((metric) => {
      const date = new Date(metric.timestamp);
      const roundedMinutes = Math.floor(date.getMinutes() / 5) * 5;
      date.setMinutes(roundedMinutes, 0, 0);
      const key = date.toISOString();

      if (!intervalData[key]) {
        intervalData[key] = {
          timestamp: key,
          storageUsed: 0n,
          storageCommitted: 0n,
          uptime: 0,
          count: 0,
        };
      }

      intervalData[key].storageUsed += metric.storageUsed || 0n;
      intervalData[key].storageCommitted += metric.storageCommitted || 0n;
      intervalData[key].uptime += metric.uptime || 0;
      intervalData[key].count++;
    });

    const historical = Object.values(intervalData).map((interval) => ({
      timestamp: interval.timestamp,
      storageUsed: interval.storageUsed.toString(),
      storageCommitted: interval.storageCommitted.toString(),
      uptime:
        interval.count > 0 ? Math.floor(interval.uptime / interval.count) : 0,
    }));

    // Find primary address (most recently updated)
    const primaryPod = allPods[0];

    // Format addresses
    const addresses = allPods.map((pod) => {
      const latestMetric = pod.metrics[0];
      return {
        address: pod.address,
        rpcPort: pod.rpcPort,
        version: pod.version,
        isPublic: pod.isPublic,
        uptime: latestMetric?.uptime || 0,
        storageUsed: latestMetric?.storageUsed?.toString() || "0",
        storageCommitted: latestMetric?.storageCommitted?.toString() || "0",
        lastSeen: pod.updatedAt.toISOString(),
        isPrimary: pod.id === primaryPod.id,
      };
    });

    // Determine if node is active (any pod updated in last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const isActive = allPods.some((pod) => pod.updatedAt > fiveMinutesAgo);

    const nodeData = {
      pubkey,
      addresses,
      currentVersion: primaryPod.version,
      lastSeen: primaryPod.updatedAt.toISOString(),
      isActive,
      historical,
    };

    return NextResponse.json({
      success: true,
      data: nodeData,
    });
  } catch (error) {
    console.error("Error fetching node data:", error);
    return NextResponse.json(
      { error: "Failed to fetch node data" },
      { status: 500 }
    );
  }
}
