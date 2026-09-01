/*
  Warnings:

  - A unique constraint covering the columns `[ruleKey]` on the table `commission_rules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ruleKey` to the `commission_rules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "commission_rules" ADD COLUMN     "ruleKey" VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "commission_rules_ruleKey_key" ON "commission_rules"("ruleKey");
