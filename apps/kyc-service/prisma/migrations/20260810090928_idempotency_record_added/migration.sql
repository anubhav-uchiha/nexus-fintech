/*
  Warnings:

  - The `status` column on the `kyc_video_verifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "kyc_video_verifications" DROP COLUMN "status",
ADD COLUMN     "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "kyc_idempotency_records" (
    "idempotencyKey" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_idempotency_records_pkey" PRIMARY KEY ("idempotencyKey")
);

-- CreateIndex
CREATE INDEX "kyc_idempotency_records_identityId_idx" ON "kyc_idempotency_records"("identityId");

-- CreateIndex
CREATE INDEX "kyc_idempotency_records_expiresAt_idx" ON "kyc_idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_idempotency_records_identityId_operation_idempotencyKey_key" ON "kyc_idempotency_records"("identityId", "operation", "idempotencyKey");
