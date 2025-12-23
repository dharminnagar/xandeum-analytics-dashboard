import { prisma } from "@/lib/db";

/**
 * Get aggregated network statistics
 */
export async function getNetworkSummary() {
  // Get latest pods data
  const pods = await prisma.pod.findMany({
    include: {
      metrics: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const totalPods = pods.length;

  // Count unique pubkeys (excluding null)
  const uniquePubkeys = new Set(
    pods.filter((p) => p.pubkey).map((p) => p.pubkey)
  ).size;

  const activePods = pods.filter(
    (p) => p.metrics[0] && p.isPublic !== null
  ).length;

  let totalStorageCommitted = 0n;
  let totalStorageUsed = 0n;
  let totalUptime = 0;
  let publicPods = 0;
  let privatePods = 0;
  const versions: Record<string, number> = {};

  pods.forEach((pod) => {
    const latestMetric = pod.metrics[0];
    if (latestMetric) {
      totalStorageCommitted += latestMetric.storageCommitted || 0n;
      totalStorageUsed += latestMetric.storageUsed || 0n;
      totalUptime += latestMetric.uptime || 0;

      // Count versions
      const version = pod.version || "unknown";
      versions[version] = (versions[version] || 0) + 1;
    }

    if (pod.isPublic === true) publicPods++;
    else if (pod.isPublic === false) privatePods++;
  });

  const avgUptime = activePods > 0 ? Math.floor(totalUptime / activePods) : 0;
  const storageUtilization =
    totalStorageCommitted > 0n
      ? Number((totalStorageUsed * 10000n) / totalStorageCommitted) / 100
      : 0;

  return {
    totalPods,
    uniquePubkeys,
    activePods,
    publicPods,
    privatePods,
    totalStorageCommitted: totalStorageCommitted.toString(),
    totalStorageUsed: totalStorageUsed.toString(),
    storageUtilization,
    avgUptime,
    versions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get historical trends for specified time period
 */
export async function getHistoricalTrends(period: "24h" | "7d" | "30d") {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // Get pod metrics over time
  const podMetrics = await prisma.podMetricsHistory.findMany({
    where: {
      timestamp: {
        gte: startDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  // Get system metrics over time
  const systemMetrics = await prisma.systemMetrics.findMany({
    where: {
      timestamp: {
        gte: startDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  });

  // Group by hour for better visualization
  const hourlyData: Record<
    string,
    {
      timestamp: string;
      podCount: number;
      totalStorage: bigint;
      usedStorage: bigint;
      avgUptime: number;
      systemCpu?: number;
      systemRam?: number;
    }
  > = {};

  podMetrics.forEach((metric) => {
    const hourKey = new Date(metric.timestamp).toISOString().slice(0, 13);
    if (!hourlyData[hourKey]) {
      hourlyData[hourKey] = {
        timestamp: hourKey + ":00:00.000Z",
        podCount: 0,
        totalStorage: 0n,
        usedStorage: 0n,
        avgUptime: 0,
      };
    }
    hourlyData[hourKey].podCount++;
    hourlyData[hourKey].totalStorage += metric.storageCommitted || 0n;
    hourlyData[hourKey].usedStorage += metric.storageUsed || 0n;
    hourlyData[hourKey].avgUptime += metric.uptime || 0;
  });

  // Add system metrics
  systemMetrics.forEach((metric) => {
    const hourKey = new Date(metric.timestamp).toISOString().slice(0, 13);
    if (hourlyData[hourKey]) {
      hourlyData[hourKey].systemCpu = Number(metric.cpuPercent);
      hourlyData[hourKey].systemRam =
        (Number(metric.ramUsed) / Number(metric.ramTotal)) * 100;
    }
  });

  // Convert to array and calculate averages
  const trends = Object.values(hourlyData).map((hour) => ({
    timestamp: hour.timestamp,
    podCount: hour.podCount,
    totalStorage: hour.totalStorage.toString(),
    usedStorage: hour.usedStorage.toString(),
    storageUtilization:
      hour.totalStorage > 0n
        ? Number((hour.usedStorage * 10000n) / hour.totalStorage) / 100
        : 0,
    avgUptime:
      hour.podCount > 0 ? Math.floor(hour.avgUptime / hour.podCount) : 0,
    systemCpu: hour.systemCpu,
    systemRam: hour.systemRam,
  }));

  return {
    period,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    dataPoints: trends,
  };
}

/**
 * Get pod rankings by various metrics
 */
export async function getPodRankings(
  metric: "storage_committed" | "storage_used" | "uptime" | "version",
  limit = 10
) {
  const pods = await prisma.pod.findMany({
    include: {
      metrics: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const podsWithMetrics = pods
    .filter((p) => p.metrics[0])
    .map((p) => ({
      pubkey: p.pubkey,
      address: p.address,
      isPublic: p.isPublic,
      version: p.version,
      storageCommitted: p.metrics[0].storageCommitted || 0n,
      storageUsed: p.metrics[0].storageUsed || 0n,
      uptime: p.metrics[0].uptime || 0,
      lastSeen: p.metrics[0].timestamp,
    }));

  let sorted;
  switch (metric) {
    case "storage_committed":
      sorted = podsWithMetrics.sort((a, b) =>
        Number(b.storageCommitted - a.storageCommitted)
      );
      break;
    case "storage_used":
      sorted = podsWithMetrics.sort((a, b) =>
        Number(b.storageUsed - a.storageUsed)
      );
      break;
    case "uptime":
      sorted = podsWithMetrics.sort((a, b) => b.uptime - a.uptime);
      break;
    case "version":
      sorted = podsWithMetrics.sort((a, b) => {
        const versionA = a.version || "";
        const versionB = b.version || "";
        return versionB.localeCompare(versionA);
      });
      break;
    default:
      sorted = podsWithMetrics;
  }

  return {
    metric,
    rankings: sorted.slice(0, limit).map((pod, index) => ({
      rank: index + 1,
      pubkey: pod.pubkey,
      address: pod.address,
      isPublic: pod.isPublic,
      version: pod.version,
      storageCommitted: pod.storageCommitted.toString(),
      storageUsed: pod.storageUsed.toString(),
      uptime: pod.uptime,
      lastSeen: pod.lastSeen.toISOString(),
    })),
  };
}
