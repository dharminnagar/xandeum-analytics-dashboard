/**
 * Fetch detailed data for a specific pod by address or pubkey.
 * GET /api/pods/[address]
 */
import { NextResponse } from "next/server";
import { XANDEUM_ENDPOINTS } from "@/config/endpoints";
import {
  getPodMetricsHistory,
  getPodByAddressOrPubkey,
} from "@/lib/db/queries/pods";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();

  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    // Try to find pod by address or pubkey
    const pod = await getPodByAddressOrPubkey(address);

    if (!pod) {
      return NextResponse.json(
        { error: "Pod not found in database" },
        { status: 404 }
      );
    }

    // Get metrics history for this pod
    const metricsHistory = await getPodMetricsHistory({
      pubkey: pod.pubkey || undefined,
      address: pod.address,
      limit: 100, // Last 100 data points
    });

    // Try to get real-time data from Xandeum network
    let liveData = null;
    try {
      // Use the first available endpoint
      const endpoint = XANDEUM_ENDPOINTS[0];
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "get-pods",
          params: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const pods = data?.stats?.result?.pods || [];

        // Find the specific pod in the live data
        liveData = pods.find(
          (p: { address: string; pubkey: string | null }) =>
            p.address === pod.address || (pod.pubkey && p.pubkey === pod.pubkey)
        );
      }
    } catch (error) {
      console.error("Failed to fetch live data:", error);
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      pod: {
        id: pod.id,
        pubkey: pod.pubkey,
        address: pod.address,
        rpcPort: pod.rpcPort,
        version: pod.version,
        isPublic: pod.isPublic,
        createdAt: pod.createdAt,
        updatedAt: pod.updatedAt,
      },
      liveData: liveData || null,
      metricsHistory: metricsHistory.map((metric) => ({
        timestamp: metric.timestamp,
        storageUsed: metric.storageUsed ? metric.storageUsed.toString() : null,
        storageCommitted: metric.storageCommitted
          ? metric.storageCommitted.toString()
          : null,
        storageUsagePercent: metric.storageUsagePercent,
        uptime: metric.uptime,
        lastSeenTimestamp: metric.lastSeenTimestamp.toString(),
        createdAt: metric.createdAt,
      })),
      metricsCount: metricsHistory.length,
      timestamp: Date.now(),
      responseTime,
    });
  } catch (error) {
    console.error("Error fetching pod data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pod data",
        message: error instanceof Error ? error.message : "Unknown error",
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
