import prisma from "../prisma";

/**
 * Save system metrics snapshot
 */
export async function saveSystemMetrics(stats: {
  timestamp: Date;
  activeStreams: number;
  cpuPercent: number;
  ramUsed: bigint;
  ramTotal: bigint;
  packetsReceived: bigint;
  packetsSent: bigint;
  uptime: number;
  currentIndex: number;
  fileSize: bigint;
  totalBytes: bigint;
  totalPages: number;
}) {
  return await prisma.systemMetrics.create({
    data: stats,
  });
}

/**
 * Get system metrics history
 */
export async function getSystemMetricsHistory(params: {
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const { from, to, limit = 1000 } = params;

  return await prisma.systemMetrics.findMany({
    where: {
      timestamp: {
        gte: from,
        lte: to,
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
  });
}

/**
 * Delete old system metrics (older than 90 days)
 */
export async function cleanupOldSystemMetrics() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return await prisma.systemMetrics.deleteMany({
    where: {
      createdAt: {
        lt: ninetyDaysAgo,
      },
    },
  });
}

/**
 * Get latest system metrics
 */
export async function getLatestSystemMetrics() {
  return await prisma.systemMetrics.findFirst({
    orderBy: {
      timestamp: "desc",
    },
  });
}
