import prisma from "../prisma";
import { OverallStats } from "@/types/stats";

/**
 * Save system metrics snapshot to database
 */
export async function saveSystemMetrics(stats: OverallStats) {
  return await prisma.systemMetrics.create({
    data: {
      timestamp: new Date(stats.last_updated * 1000),
      activeStreams: stats.active_streams,
      cpuPercent: stats.cpu_percent,
      ramUsed: BigInt(stats.ram_used),
      ramTotal: BigInt(stats.ram_total),
      packetsReceived: BigInt(stats.packets_received),
      packetsSent: BigInt(stats.packets_sent),
      uptime: stats.uptime,
      currentIndex: stats.current_index,
      fileSize: BigInt(stats.file_size),
      totalBytes: BigInt(stats.total_bytes),
      totalPages: stats.total_pages,
    },
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
