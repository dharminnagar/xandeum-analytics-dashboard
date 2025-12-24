import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filters
    const isPublic = searchParams.get("isPublic");
    const version = searchParams.get("version");
    const minStorage = searchParams.get("minStorage");
    const maxStorage = searchParams.get("maxStorage");
    const minUptime = searchParams.get("minUptime");
    const search = searchParams.get("search"); // Search by pubkey or address

    // Build where clause
    const where: Prisma.PodWhereInput = {};

    if (isPublic !== null) {
      if (isPublic === "true") where.isPublic = true;
      else if (isPublic === "false") where.isPublic = false;
    }

    if (search) {
      where.OR = [
        { pubkey: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get all pods with filters (no pagination on server)
    const pods = await prisma.pod.findMany({
      where,
      include: {
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Apply metric-based filters (after fetching latest metrics)
    let filteredPods = pods.filter((p) => p.metrics.length > 0 && p.metrics[0]);

    if (version) {
      filteredPods = filteredPods.filter((p) => p.version === version);
    }

    if (minStorage) {
      const minStorageBigInt = BigInt(minStorage);
      filteredPods = filteredPods.filter(
        (p) =>
          p.metrics[0].storageCommitted !== null &&
          p.metrics[0].storageCommitted >= minStorageBigInt
      );
    }

    if (maxStorage) {
      const maxStorageBigInt = BigInt(maxStorage);
      filteredPods = filteredPods.filter(
        (p) =>
          p.metrics[0].storageCommitted !== null &&
          p.metrics[0].storageCommitted <= maxStorageBigInt
      );
    }

    if (minUptime) {
      const minUptimeNum = parseInt(minUptime);
      filteredPods = filteredPods.filter(
        (p) =>
          p.metrics[0].uptime !== null && p.metrics[0].uptime >= minUptimeNum
      );
    }

    // Format response
    const results = filteredPods.map((pod) => {
      const metric = pod.metrics[0];
      return {
        id: pod.id,
        pubkey: pod.pubkey,
        address: pod.address,
        isPublic: pod.isPublic,
        rpcPort: pod.rpcPort,
        version: pod.version,
        storageCommitted: metric.storageCommitted?.toString() || "0",
        storageUsed: metric.storageUsed?.toString() || "0",
        storageUsagePercent: metric.storageUsagePercent?.toString() || "0",
        uptime: metric.uptime || 0,
        lastSeen: metric.timestamp.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        pods: results,
        total: results.length,
        filters: {
          isPublic,
          version,
          minStorage,
          maxStorage,
          minUptime,
          search,
        },
      },
    });
  } catch (error) {
    console.error("Error filtering pods:", error);
    return NextResponse.json(
      { error: "Failed to filter pods" },
      { status: 500 }
    );
  }
}
