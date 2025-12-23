import prisma from "../lib/db/prisma";

async function main() {
  console.log("Clearing database...");

  // Delete in order: metrics first (due to foreign key), then pods, then system metrics
  const deletedMetrics = await prisma.podMetricsHistory.deleteMany({});
  console.log(`Deleted ${deletedMetrics.count} pod metrics records`);

  const deletedPods = await prisma.pod.deleteMany({});
  console.log(`Deleted ${deletedPods.count} pod records`);

  const deletedSystemMetrics = await prisma.systemMetrics.deleteMany({});
  console.log(`Deleted ${deletedSystemMetrics.count} system metrics records`);

  console.log("\n✓ Database cleared successfully!");

  await prisma.$disconnect();
}

main();
