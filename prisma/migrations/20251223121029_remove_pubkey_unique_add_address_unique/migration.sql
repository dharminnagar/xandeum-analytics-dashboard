/*
  Warnings:

  - A unique constraint covering the columns `[address]` on the table `pods` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "pods_address_idx";

-- DropIndex
DROP INDEX "pods_pubkey_key";

-- CreateIndex
CREATE UNIQUE INDEX "pods_address_key" ON "pods"("address");
