-- AlterTable
ALTER TABLE "identities" ADD COLUMN     "createdByIdentityId" TEXT,
ADD COLUMN     "createdBySuperAdminId" TEXT;

-- CreateIndex
CREATE INDEX "identities_createdBySuperAdminId_idx" ON "identities"("createdBySuperAdminId");

-- CreateIndex
CREATE INDEX "identities_createdByIdentityId_idx" ON "identities"("createdByIdentityId");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_createdBySuperAdminId_fkey" FOREIGN KEY ("createdBySuperAdminId") REFERENCES "super_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_createdByIdentityId_fkey" FOREIGN KEY ("createdByIdentityId") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
