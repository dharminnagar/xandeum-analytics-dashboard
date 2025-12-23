import prisma from "../prisma";
import { Pod as PodType } from "@/types/nodes";

/**
 * Upsert a pod (create if doesn't exist, update if exists)
 */
export async function upsertPod(pod: PodType) {
  // Address is the unique key so we persist every distinct endpoint even if pubkeys repeat
  return await prisma.pod.upsert({
    where: { address: pod.address },
    update: {
      pubkey: pod.pubkey ?? null,
      rpcPort: pod.rpc_port,
      version: pod.version,
      isPublic: pod.is_public,
      updatedAt: new Date(),
    },
    create: {
      pubkey: pod.pubkey ?? null,
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
 * Get a single pod by address or pubkey
 */
export async function getPodByAddressOrPubkey(addressOrPubkey: string) {
  return await prisma.pod.findFirst({
    where: {
      OR: [{ address: addressOrPubkey }, { pubkey: addressOrPubkey }],
    },
    include: {
      metrics: {
        orderBy: {
          timestamp: "desc",
        },
        take: 1, // Include latest metric
      },
    },
  });
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
