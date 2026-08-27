/*
  Warnings:

  - The values [KYC_PENDING,OTP_PENDING,TWO_FA_PENDING] on the enum `AepsMerchantStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `kycCompleted` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `kycCompletedAt` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `lastTwoFactorAuthAt` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingClientRefId` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `otpVerified` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `otpVerifiedAt` on the `AepsMerchantProfile` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `AepsMerchantProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VimopayOnboardingStep" AS ENUM ('NOT_STARTED', 'REGISTRATION_PENDING', 'OTP_PENDING', 'OTP_VERIFIED', 'EKYC_PENDING', 'EKYC_COMPLETED', 'TWO_FA_PENDING', 'ACTIVE', 'REJECTED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "AepsMerchantStatus_new" AS ENUM ('NOT_STARTED', 'ONBOARDING', 'ACTION_REQUIRED', 'UNDER_REVIEW', 'ACTIVE', 'REJECTED', 'FAILED', 'SUSPENDED', 'BLOCKED');
ALTER TABLE "public"."AepsMerchantProfile" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AepsMerchantProfile" ALTER COLUMN "status" TYPE "AepsMerchantStatus_new" USING ("status"::text::"AepsMerchantStatus_new");
ALTER TYPE "AepsMerchantStatus" RENAME TO "AepsMerchantStatus_old";
ALTER TYPE "AepsMerchantStatus_new" RENAME TO "AepsMerchantStatus";
DROP TYPE "public"."AepsMerchantStatus_old";
ALTER TABLE "AepsMerchantProfile" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
COMMIT;

-- AlterEnum
ALTER TYPE "AepsProvider" ADD VALUE 'SPICE_MONEY';

-- DropIndex
DROP INDEX "AepsMerchantProfile_provider_onboardingClientRefId_key";

-- AlterTable
ALTER TABLE "AepsMerchantProfile" DROP COLUMN "kycCompleted",
DROP COLUMN "kycCompletedAt",
DROP COLUMN "lastTwoFactorAuthAt",
DROP COLUMN "onboardingClientRefId",
DROP COLUMN "otpVerified",
DROP COLUMN "otpVerifiedAt",
DROP COLUMN "rejectionReason",
ADD COLUMN     "bankAccountId" UUID,
ADD COLUMN     "kycProfileId" UUID,
ADD COLUMN     "providerRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "providerRegistrationCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusReason" VARCHAR(500);

-- CreateTable
CREATE TABLE "VimopayMerchantDetail" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "pipe" VARCHAR(10) NOT NULL DEFAULT '1',
    "onboardingStep" "VimopayOnboardingStep" NOT NULL DEFAULT 'NOT_STARTED',
    "registrationClientRefId" VARCHAR(64),
    "registrationTxnRefId" VARCHAR(150),
    "lastOtpClientRefId" VARCHAR(64),
    "lastOtpTxnRefId" VARCHAR(150),
    "lastOtpSentAt" TIMESTAMP(3),
    "otpVerifyClientRefId" VARCHAR(64),
    "otpVerifyTxnRefId" VARCHAR(150),
    "otpVerifiedAt" TIMESTAMP(3),
    "ekycClientRefId" VARCHAR(64),
    "ekycTxnRefId" VARCHAR(150),
    "ekycCompletedAt" TIMESTAMP(3),
    "lastTwoFactorClientRefId" VARCHAR(64),
    "lastTwoFactorTxnRefId" VARCHAR(150),
    "lastTwoFactorAuthAt" TIMESTAMP(3),
    "lastProviderStatusCode" VARCHAR(20),
    "lastProviderStatusMessage" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VimopayMerchantDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VimopayMerchantDetail_profileId_key" ON "VimopayMerchantDetail"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "VimopayMerchantDetail_registrationClientRefId_key" ON "VimopayMerchantDetail"("registrationClientRefId");

-- CreateIndex
CREATE INDEX "VimopayMerchantDetail_onboardingStep_idx" ON "VimopayMerchantDetail"("onboardingStep");

-- CreateIndex
CREATE INDEX "VimopayMerchantDetail_lastTwoFactorAuthAt_idx" ON "VimopayMerchantDetail"("lastTwoFactorAuthAt");

-- CreateIndex
CREATE INDEX "AepsMerchantProfile_bankAccountId_idx" ON "AepsMerchantProfile"("bankAccountId");

-- CreateIndex
CREATE INDEX "AepsMerchantProfile_kycProfileId_idx" ON "AepsMerchantProfile"("kycProfileId");

-- AddForeignKey
ALTER TABLE "VimopayMerchantDetail" ADD CONSTRAINT "VimopayMerchantDetail_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AepsMerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
