-- CreateEnum
CREATE TYPE "AepsProvider" AS ENUM ('EKO', 'PAYSPRINT');

-- CreateEnum
CREATE TYPE "AepsMerchantStatus" AS ENUM ('NOT_STARTED', 'ONBOARDING', 'KYC_PENDING', 'UNDER_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED');

-- CreateTable
CREATE TABLE "AepsMerchantProfile" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "provider" "AepsProvider" NOT NULL,
    "providerMerchantId" TEXT,
    "providerUserCode" TEXT,
    "status" "AepsMerchantStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "kycCompleted" BOOLEAN NOT NULL DEFAULT false,
    "serviceActivated" BOOLEAN NOT NULL DEFAULT false,
    "lastStatusCheckedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AepsMerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AepsMerchantProfile_identityId_provider_key" ON "AepsMerchantProfile"("identityId", "provider");
