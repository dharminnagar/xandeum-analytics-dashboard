import prisma from "@/lib/db/prisma";

async function main() {
  const totalPods = await prisma.pod.count();
  const uniquePubkeys = await prisma.pod.groupBy({
    by: ["pubkey"],
  });

  const pubkeyCounts = await prisma.pod.groupBy({
    by: ["pubkey"],
    _count: {
      id: true,
    },
  });

  const repeatedPubkeys = pubkeyCounts.filter((p) => p._count.id > 1);

  console.log("Total pods in database:", totalPods);
  console.log("Unique pubkeys:", uniquePubkeys.length);
  console.log("Pubkeys with multiple addresses:", repeatedPubkeys.length);

  if (repeatedPubkeys.length > 0) {
    console.log("\nTop repeated pubkeys:");
    repeatedPubkeys
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5)
      .forEach((p) => {
        console.log(`  ${p.pubkey || "NULL"}: ${p._count.id} addresses`);
      });
  }

  await prisma.$disconnect();
}

main();
