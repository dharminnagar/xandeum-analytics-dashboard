import prisma from "../prisma";
import { Pod as PodType } from "@/types/nodes";

/**
 * Upsert a pod (create if doesn't exist, update if exists)
 */
export async function upsertPod(pod: PodType) {
  // If pod has pubkey, use it as unique identifier
  if (pod.pubkey) {
    return await prisma.pod.upsert({
      where: { pubkey: pod.pubkey },
      update: {
        address: pod.address,
        rpcPort: pod.rpc_port,
        version: pod.version,
        isPublic: pod.is_public,
        updatedAt: new Date(),
      },
      create: {
        pubkey: pod.pubkey,
        address: pod.address,
        rpcPort: pod.rpc_port,
        version: pod.version,
        isPublic: pod.is_public,
      },
    });
  }

  // If no pubkey, find by address or create new
  const existing = await prisma.pod.findFirst({
    where: {
      pubkey: null,
      address: pod.address,
    },
  });

  if (existing) {
    return await prisma.pod.update({
      where: { id: existing.id },
      data: {
        rpcPort: pod.rpc_port,
        version: pod.version,
        isPublic: pod.is_public,
        updatedAt: new Date(),
      },
    });
  }

  return await prisma.pod.create({
    data: {
      pubkey: null,
      address: pod.address,
      rpcPort: pod.rpc_port,
      version: pod.version,
      isPublic: pod.is_public,
    },
  });
}

/**
 * Save pod metrics history
 */
export async function savePodMetrics(podId: number, pod: PodType) {
  return await prisma.podMetricsHistory.create({
    data: {
      podId,
      timestamp: new Date(pod.last_seen_timestamp * 1000),
      storageUsed: pod.storage_used ? BigInt(pod.storage_used) : null,
      storageCommitted: pod.storage_committed
        ? BigInt(pod.storage_committed)
        : null,
      storageUsagePercent: pod.storage_usage_percent,
      uptime: pod.uptime,
      lastSeenTimestamp: BigInt(pod.last_seen_timestamp),
    },
  });
}

/**
 * Get pod metrics history
 */
export async function getPodMetricsHistory(params: {
  pubkey?: string;
  address?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const { pubkey, address, from, to, limit = 1000 } = params;

  // Find the pod first
  const pod = await prisma.pod.findFirst({
    where: pubkey ? { pubkey } : address ? { address } : undefined,
  });

  if (!pod) {
    return [];
  }

  return await prisma.podMetricsHistory.findMany({
    where: {
      podId: pod.id,
      timestamp: {
        gte: from,
        lte: to,
      },
    },
    include: {
      pod: true,
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
  });
}

/**
 * Get all pods with their latest metrics
 */
export async function getPodsWithLatestMetrics() {
  const pods = await prisma.pod.findMany({
    include: {
      metrics: {
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      },
    },
  });

  return pods;
}

/**
 * Delete old pod metrics (older than 90 days)
 */
export async function cleanupOldPodMetrics() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  return await prisma.podMetricsHistory.deleteMany({
    where: {
      createdAt: {
        lt: ninetyDaysAgo,
      },
    },
  });
}
