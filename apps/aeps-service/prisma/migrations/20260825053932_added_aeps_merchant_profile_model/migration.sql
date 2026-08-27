/*
  Warnings:

  - The values [EKO] on the enum `AepsProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `providerMerchantId` on the `AepsMerchantProfile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `providerUserCode` on the `AepsMerchantProfile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `rejectionReason` on the `AepsMerchantProfile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - A unique constraint covering the columns `[provider,providerMerchantId]` on the table `AepsMerchantProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,onboardingClientRefId]` on the table `AepsMerchantProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AepsMerchantStatus" ADD VALUE 'OTP_PENDING';
ALTER TYPE "AepsMerchantStatus" ADD VALUE 'TWO_FA_PENDING';

-- AlterEnum
BEGIN;
CREATE TYPE "AepsProvider_new" AS ENUM ('VIMOPAY', 'PAYSPRINT');
ALTER TABLE "AepsMerchantProfile" ALTER COLUMN "provider" TYPE "AepsProvider_new" USING ("provider"::text::"AepsProvider_new");
ALTER TYPE "AepsProvider" RENAME TO "AepsProvider_old";
ALTER TYPE "AepsProvider_new" RENAME TO "AepsProvider";
DROP TYPE "public"."AepsProvider_old";
COMMIT;

-- AlterTable
ALTER TABLE "AepsMerchantProfile" ADD COLUMN     "kycCompletedAt" TIMESTAMP(3),
ADD COLUMN     "lastTwoFactorAuthAt" TIMESTAMP(3),
ADD COLUMN     "onboardingClientRefId" VARCHAR(64),
ADD COLUMN     "otpVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpVerifiedAt" TIMESTAMP(3),
ALTER COLUMN "providerMerchantId" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "providerUserCode" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "rejectionReason" SET DATA TYPE VARCHAR(500);

-- CreateIndex
CREATE INDEX "AepsMerchantProfile_identityId_idx" ON "AepsMerchantProfile"("identityId");

-- CreateIndex
CREATE INDEX "AepsMerchantProfile_provider_status_idx" ON "AepsMerchantProfile"("provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AepsMerchantProfile_provider_providerMerchantId_key" ON "AepsMerchantProfile"("provider", "providerMerchantId");

-- CreateIndex
CREATE UNIQUE INDEX "AepsMerchantProfile_provider_onboardingClientRefId_key" ON "AepsMerchantProfile"("provider", "onboardingClientRefId");
