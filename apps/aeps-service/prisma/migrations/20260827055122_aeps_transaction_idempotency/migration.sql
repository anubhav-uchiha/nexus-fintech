-- CreateEnum
CREATE TYPE "AepsFinancialTransactionType" AS ENUM ('CASH_WITHDRAWAL', 'AADHAAR_PAY', 'CASH_DEPOSIT');

-- CreateEnum
CREATE TYPE "AepsIdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN');

-- CreateTable
CREATE TABLE "AepsTransactionIdempotency" (
    "id" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "provider" "AepsProvider" NOT NULL,
    "transactionType" "AepsFinancialTransactionType" NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "lockToken" VARCHAR(64),
    "status" "AepsIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerMerchantRefId" VARCHAR(100),
    "providerTxnRefId" VARCHAR(150),
    "providerStatusCode" VARCHAR(20),
    "response" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AepsTransactionIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AepsTransactionIdempotency_profileId_status_idx" ON "AepsTransactionIdempotency"("profileId", "status");

-- CreateIndex
CREATE INDEX "AepsTransactionIdempotency_identityId_createdAt_idx" ON "AepsTransactionIdempotency"("identityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AepsTransactionIdempotency_identityId_provider_transactionT_key" ON "AepsTransactionIdempotency"("identityId", "provider", "transactionType", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "AepsTransactionIdempotency" ADD CONSTRAINT "AepsTransactionIdempotency_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AepsMerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
