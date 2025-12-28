import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// In-memory cache with timestamps
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Generic cache wrapper with automatic background refresh
 */
async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  // Return cached data if still fresh
  if (cached && now - cached.timestamp < cached.expiresIn * 1000) {
    // Refresh in background if more than 50% expired
    if (now - cached.timestamp > (cached.expiresIn * 1000) / 2) {
      // Non-blocking background refresh
      fetchFn()
        .then((data) => {
          cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn: ttlSeconds,
          });
        })
        .catch(console.error);
    }
    return cached.data;
  }

  // Fetch fresh data
  const data = await fetchFn();
  cache.set(key, {
    data,
    timestamp: now,
    expiresIn: ttlSeconds,
  });

  return data;
}

/**
 * Get aggregated network statistics with caching
 */
export async function getNetworkSummary() {
  return getCached(
    "network-summary",
    async () => {
      // Use aggregation queries instead of loading all data
      const [podCount, metrics] = await Promise.all([
        prisma.pod.count(),
        prisma.$queryRaw<
          Array<{
            total_committed: bigint;
            total_used: bigint;
            avg_uptime: number;
            public_count: bigint;
            private_count: bigint;
            active_count: bigint;
          }>
        >`
        SELECT 
          COALESCE(SUM(m.storage_committed), 0) as total_committed,
          COALESCE(SUM(m.storage_used), 0) as total_used,
          COALESCE(AVG(m.uptime), 0) as avg_uptime,
          COUNT(CASE WHEN p.is_public = true THEN 1 END) as public_count,
          COUNT(CASE WHEN p.is_public = false THEN 1 END) as private_count,
          COUNT(*) as active_count
        FROM (
          SELECT DISTINCT ON (pod_id) *
          FROM pod_metrics_history
          ORDER BY pod_id, timestamp DESC
        ) m
        JOIN pods p ON m.pod_id = p.id
      `,
      ]);

      const metric = metrics[0];

      // Get unique pubkeys count
      const uniquePubkeys = await prisma.pod.findMany({
        where: { pubkey: { not: null } },
        distinct: ["pubkey"],
        select: { pubkey: true },
      });

      // Get version distribution
      const versions = await prisma.pod.groupBy({
        by: ["version"],
        _count: true,
        where: { version: { not: undefined } },
      });

      const totalCommitted = BigInt(metric.total_committed.toString());
      const totalUsed = BigInt(metric.total_used.toString());
      const storageUtilization =
        totalCommitted > 0n
          ? Number((totalUsed * 10000n) / totalCommitted) / 100
          : 0;

      return {
        totalPods: podCount,
        uniquePubkeys: uniquePubkeys.length,
        activePods: Number(metric.active_count),
        publicPods: Number(metric.public_count),
        privatePods: Number(metric.private_count),
        totalStorageCommitted: totalCommitted.toString(),
        totalStorageUsed: totalUsed.toString(),
        storageUtilization,
        avgUptime: Math.floor(metric.avg_uptime || 0),
        versions: Object.fromEntries(
          versions.map((v) => [v.version || "unknown", v._count])
        ),
        timestamp: new Date().toISOString(),
      };
    },
    30
  ); // Cache for 30 seconds
}

/**
 * Get historical trends with caching and optimized queries
 */
export async function getHistoricalTrends(period: "24h" | "7d" | "30d") {
  return getCached(
    `trends-${period}`,
    async () => {
      const now = new Date();
      let startDate: Date;
      let intervalMinutes: number;

      switch (period) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          intervalMinutes = 5;
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          intervalMinutes = 30;
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          intervalMinutes = 120;
          break;
      }

      // Use raw SQL for better performance with time-based aggregation
      const podTrends = await prisma.$queryRaw<
        Array<{
          interval_time: Date;
          pod_count: bigint;
          total_committed: bigint;
          total_used: bigint;
          avg_uptime: number;
        }>
      >`
      SELECT 
        date_trunc('hour', timestamp) + 
        (floor(EXTRACT(MINUTE FROM timestamp)::numeric / ${intervalMinutes}::numeric) * ${intervalMinutes}::numeric) * INTERVAL '1 minute' as interval_time,
        COUNT(DISTINCT pod_id) as pod_count,
        COALESCE(SUM(storage_committed), 0) as total_committed,
        COALESCE(SUM(storage_used), 0) as total_used,
        COALESCE(AVG(uptime), 0) as avg_uptime
      FROM pod_metrics_history
      WHERE timestamp >= ${startDate}::timestamptz
      GROUP BY interval_time
      ORDER BY interval_time ASC
    `;

      // Get system metrics (optional, can be joined in single query if needed)
      const systemTrends = await prisma.$queryRaw<
        Array<{
          interval_time: Date;
          avg_cpu: number;
          avg_ram: number;
        }>
      >`
      SELECT 
        date_trunc('hour', timestamp) + 
        (floor(EXTRACT(MINUTE FROM timestamp)::numeric / ${intervalMinutes}::numeric) * ${intervalMinutes}::numeric) * INTERVAL '1 minute' as interval_time,
        AVG(CAST(cpu_percent AS FLOAT)) as avg_cpu,
        AVG(CAST(ram_used AS FLOAT) / CAST(ram_total AS FLOAT) * 100) as avg_ram
      FROM system_metrics
      WHERE timestamp >= ${startDate}::timestamptz
      GROUP BY interval_time
      ORDER BY interval_time ASC
    `;

      // Merge system metrics with pod metrics
      const systemMap = new Map(
        systemTrends.map((s) => [s.interval_time.toISOString(), s])
      );

      const trends = podTrends.map((trend) => {
        const totalCommitted = BigInt(trend.total_committed.toString());
        const totalUsed = BigInt(trend.total_used.toString());
        const systemData = systemMap.get(trend.interval_time.toISOString());

        return {
          timestamp: trend.interval_time.toISOString(),
          podCount: Number(trend.pod_count),
          totalStorage: totalCommitted.toString(),
          usedStorage: totalUsed.toString(),
          storageUtilization:
            totalCommitted > 0n
              ? Number((totalUsed * 10000n) / totalCommitted) / 100
              : 0,
          avgUptime: Math.floor(trend.avg_uptime || 0),
          systemCpu: systemData?.avg_cpu,
          systemRam: systemData?.avg_ram,
        };
      });

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        dataPoints: trends,
      };
    },
    60
  ); // Cache for 60 seconds
}

/**
 * Get pod rankings with caching
 */
export async function getPodRankings(
  metric: "storage_committed" | "storage_used" | "uptime" | "version",
  limit = 10
) {
  return getCached(
    `rankings-${metric}-${limit}`,
    async () => {
      // Use single raw SQL query with JOIN for better performance
      const results = await prisma.$queryRaw<
        Array<{
          pubkey: string | null;
          address: string;
          is_public: boolean | null;
          version: string;
          storage_committed: bigint | null;
          storage_used: bigint | null;
          uptime: number | null;
          timestamp: Date;
        }>
      >`
      SELECT 
        p.pubkey,
        p.address,
        p.is_public,
        p.version,
        m.storage_committed,
        m.storage_used,
        m.uptime,
        m.timestamp
      FROM pods p
      INNER JOIN (
        SELECT DISTINCT ON (pod_id)
          pod_id,
          storage_committed,
          storage_used,
          uptime,
          timestamp
        FROM pod_metrics_history
        ORDER BY pod_id, timestamp DESC
      ) m ON p.id = m.pod_id
      ORDER BY 
        ${metric === "storage_committed" ? Prisma.sql`m.storage_committed DESC NULLS LAST` : Prisma.empty}
        ${metric === "storage_used" ? Prisma.sql`m.storage_used DESC NULLS LAST` : Prisma.empty}
        ${metric === "uptime" ? Prisma.sql`m.uptime DESC NULLS LAST` : Prisma.empty}
        ${metric === "version" ? Prisma.sql`p.version DESC` : Prisma.empty}
      LIMIT ${limit}
    `;

      return {
        metric,
        rankings: results.map((pod, index) => ({
          rank: index + 1,
          pubkey: pod.pubkey,
          address: pod.address,
          isPublic: pod.is_public,
          version: pod.version,
          storageCommitted: (pod.storage_committed ?? 0n).toString(),
          storageUsed: (pod.storage_used ?? 0n).toString(),
          uptime: pod.uptime ?? 0,
          lastSeen: pod.timestamp.toISOString(),
        })),
      };
    },
    45
  ); // Cache for 45 seconds
}

/**
 * Clear all cache (useful for testing or manual refresh)
 */
export function clearStatsCache() {
  cache.clear();
}
