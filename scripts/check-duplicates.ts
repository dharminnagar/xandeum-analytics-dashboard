import prisma from "../lib/db/prisma";

async function main() {
  const duplicates = await prisma.$queryRaw<
    Array<{ address: string; count: bigint }>
  >`
    SELECT address, COUNT(*) as count 
    FROM pods 
    GROUP BY address 
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  console.log(`Found ${duplicates.length} duplicate addresses:`);
  duplicates.forEach((d) => {
    console.log(`  ${d.address}: ${d.count} times`);
  });

  await prisma.$disconnect();
}

main();
