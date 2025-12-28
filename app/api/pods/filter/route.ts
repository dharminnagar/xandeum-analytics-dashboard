import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30; // Cache for 30 seconds

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

    // Build where clause for pods
    const podWhere: Prisma.PodWhereInput = {};

    if (isPublic !== null) {
      if (isPublic === "true") podWhere.isPublic = true;
      else if (isPublic === "false") podWhere.isPublic = false;
    }

    if (version) {
      podWhere.version = version;
    }

    if (search) {
      podWhere.OR = [
        { pubkey: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    // Use raw SQL for better performance with latest metrics
    const results = await prisma.$queryRaw<
      Array<{
        id: number;
        pubkey: string | null;
        address: string;
        is_public: boolean | null;
        rpc_port: number | null;
        version: string;
        storage_committed: bigint | null;
        storage_used: bigint | null;
        storage_usage_percent: number | null;
        uptime: number | null;
        timestamp: Date;
      }>
    >`
      SELECT 
        p.id,
        p.pubkey,
        p.address,
        p.is_public,
        p.rpc_port,
        p.version,
        m.storage_committed,
        m.storage_used,
        m.storage_usage_percent,
        m.uptime,
        m.timestamp
      FROM pods p
      INNER JOIN (
        SELECT DISTINCT ON (pod_id)
          pod_id,
          storage_committed,
          storage_used,
          storage_usage_percent,
          uptime,
          timestamp
        FROM pod_metrics_history
        ORDER BY pod_id, timestamp DESC
      ) m ON p.id = m.pod_id
      WHERE 1=1
        ${version ? Prisma.sql`AND p.version = ${version}` : Prisma.empty}
        ${isPublic === "true" ? Prisma.sql`AND p.is_public = true` : Prisma.empty}
        ${isPublic === "false" ? Prisma.sql`AND p.is_public = false` : Prisma.empty}
        ${search ? Prisma.sql`AND (p.pubkey ILIKE ${"%" + search + "%"} OR p.address ILIKE ${"%" + search + "%"})` : Prisma.empty}
        ${minStorage ? Prisma.sql`AND m.storage_committed >= ${BigInt(minStorage)}` : Prisma.empty}
        ${maxStorage ? Prisma.sql`AND m.storage_committed <= ${BigInt(maxStorage)}` : Prisma.empty}
        ${minUptime ? Prisma.sql`AND m.uptime >= ${parseInt(minUptime)}` : Prisma.empty}
      ORDER BY p.updated_at DESC
    `;

    // Format response
    const pods = results.map((pod) => ({
      id: pod.id,
      pubkey: pod.pubkey,
      address: pod.address,
      isPublic: pod.is_public,
      rpcPort: pod.rpc_port,
      version: pod.version,
      storageCommitted: pod.storage_committed?.toString() || "0",
      storageUsed: pod.storage_used?.toString() || "0",
      storageUsagePercent: pod.storage_usage_percent?.toString() || "0",
      uptime: pod.uptime || 0,
      lastSeen: pod.timestamp.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          pods,
          total: pods.length,
          filters: {
            isPublic,
            version,
            minStorage,
            maxStorage,
            minUptime,
            search,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error filtering pods:", error);
    return NextResponse.json(
      { error: "Failed to filter pods" },
      { status: 500 }
    );
  }
}
