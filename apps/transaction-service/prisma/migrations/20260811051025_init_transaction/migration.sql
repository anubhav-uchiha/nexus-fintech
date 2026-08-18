-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('MAIN', 'AEPS', 'PROFIT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED', 'REFUNDED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletType" "WalletType" NOT NULL,
    "serviceType" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "externalReference" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_referenceId_key" ON "transactions"("referenceId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_walletType_idx" ON "transactions"("walletType");

-- CreateIndex
CREATE INDEX "transactions_serviceType_idx" ON "transactions"("serviceType");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_userId_walletType_createdAt_idx" ON "transactions"("userId", "walletType", "createdAt");
