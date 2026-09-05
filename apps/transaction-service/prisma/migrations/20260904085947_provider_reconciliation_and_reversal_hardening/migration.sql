-- CreateEnum
CREATE TYPE "ProviderReversalComponentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderReconciliationStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderReconciliationResolution" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderReconciliationAction" AS ENUM ('NONE', 'SETTLE_PRINCIPAL', 'CONFIRM_RESERVATION', 'COMPENSATE_RESERVATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderCommissionStatus" ADD VALUE 'WAITING_PROVIDER_INCOME';
ALTER TYPE "ProviderCommissionStatus" ADD VALUE 'REVERSED';

-- AlterTable
ALTER TABLE "provider_transaction_reversals" ADD COLUMN     "commission_failure_reason" VARCHAR(500),
ADD COLUMN     "commission_reversal_reference" VARCHAR(150),
ADD COLUMN     "commission_status" "ProviderReversalComponentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "principal_compensation_reference" VARCHAR(150),
ADD COLUMN     "principal_failure_reason" VARCHAR(500),
ADD COLUMN     "principal_status" "ProviderReversalComponentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "provider_transaction_reconciliations" (
    "id" UUID NOT NULL,
    "reference_id" VARCHAR(100) NOT NULL,
    "provider_transaction_id" UUID NOT NULL,
    "original_status" "ProviderTransactionStatus" NOT NULL,
    "resolution" "ProviderReconciliationResolution" NOT NULL,
    "status" "ProviderReconciliationStatus" NOT NULL DEFAULT 'PROCESSING',
    "action" "ProviderReconciliationAction" NOT NULL DEFAULT 'NONE',
    "resolved_by" VARCHAR(100) NOT NULL,
    "note" VARCHAR(500),
    "provider_txn_ref_id" VARCHAR(150),
    "rrn" VARCHAR(50),
    "npci_code" VARCHAR(20),
    "npci_message" VARCHAR(250),
    "wallet_transaction_reference" VARCHAR(150),
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "failure_reason" VARCHAR(500),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_transaction_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_transaction_reconciliations_reference_id_key" ON "provider_transaction_reconciliations"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_transaction_reconciliations_provider_transaction_i_key" ON "provider_transaction_reconciliations"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "provider_transaction_reconciliations_status_idx" ON "provider_transaction_reconciliations"("status");

-- CreateIndex
CREATE INDEX "provider_transaction_reconciliations_resolution_idx" ON "provider_transaction_reconciliations"("resolution");

-- CreateIndex
CREATE INDEX "provider_transaction_reconciliations_resolved_by_idx" ON "provider_transaction_reconciliations"("resolved_by");

-- CreateIndex
CREATE INDEX "provider_transaction_reconciliations_created_at_idx" ON "provider_transaction_reconciliations"("created_at");

-- AddForeignKey
ALTER TABLE "provider_transaction_reconciliations" ADD CONSTRAINT "provider_transaction_reconciliations_provider_transaction__fkey" FOREIGN KEY ("provider_transaction_id") REFERENCES "provider_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
