/*
  Warnings:

  - A unique constraint covering the columns `[distributionKey]` on the table `commission_distributions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `distributionKey` to the `commission_distributions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "commission_distributions" ADD COLUMN     "distributionKey" VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "commission_distributions_distributionKey_key" ON "commission_distributions"("distributionKey");
