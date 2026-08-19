/*
  Warnings:

  - You are about to drop the column `isPackageControlled` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the `role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[prefix]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prefix` to the `roles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_roleId_fkey";

-- AlterTable
ALTER TABLE "permissions" DROP COLUMN "isPackageControlled";

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "lastLoginIdNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prefix" VARCHAR(10);

UPDATE "roles"
SET "prefix" = CASE "name"
  WHEN 'SUPER_ADMIN' THEN 'SUP'
  WHEN 'ADMIN' THEN 'ADMIN'
  WHEN 'DISTRIBUTOR' THEN 'UDT'
  WHEN 'RETAILER' THEN 'KRT'
END;

-- Make prefix required after filling existing records
ALTER TABLE "roles"
ALTER COLUMN "prefix" SET NOT NULL;

-- DropTable
DROP TABLE "role_permissions";

-- CreateIndex
CREATE UNIQUE INDEX "roles_prefix_key" ON "roles"("prefix");
