/*
  Warnings:

  - A unique constraint covering the columns `[relationshipKey]` on the table `commission_hierarchies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[activeScopeKey]` on the table `commission_hierarchies` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `relationshipKey` to the `commission_hierarchies` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "commission_hierarchies_parentUserId_childUserId_serviceType_key";

-- AlterTable
ALTER TABLE "commission_hierarchies" ADD COLUMN     "activeScopeKey" VARCHAR(64),
ADD COLUMN     "relationshipKey" VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "commission_hierarchies_relationshipKey_key" ON "commission_hierarchies"("relationshipKey");

-- CreateIndex
CREATE UNIQUE INDEX "commission_hierarchies_activeScopeKey_key" ON "commission_hierarchies"("activeScopeKey");
