-- CreateEnum
CREATE TYPE "ProviderTransactionReversalStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "provider_transaction_reversals" (
    "id" UUID NOT NULL,
    "reference_id" VARCHAR(100) NOT NULL,
    "provider_transaction_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "ProviderTransactionReversalStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(500) NOT NULL,
    "requested_by" VARCHAR(100) NOT NULL,
    "compensation_reference_id" VARCHAR(150),
    "processing_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_transaction_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_transaction_reversals_reference_id_key" ON "provider_transaction_reversals"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_transaction_reversals_provider_transaction_id_key" ON "provider_transaction_reversals"("provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_transaction_reversals_idempotency_key_key" ON "provider_transaction_reversals"("idempotency_key");

-- CreateIndex
CREATE INDEX "provider_transaction_reversals_status_idx" ON "provider_transaction_reversals"("status");

-- CreateIndex
CREATE INDEX "provider_transaction_reversals_requested_by_idx" ON "provider_transaction_reversals"("requested_by");

-- CreateIndex
CREATE INDEX "provider_transaction_reversals_created_at_idx" ON "provider_transaction_reversals"("created_at");

-- AddForeignKey
ALTER TABLE "provider_transaction_reversals" ADD CONSTRAINT "provider_transaction_reversals_provider_transaction_id_fkey" FOREIGN KEY ("provider_transaction_id") REFERENCES "provider_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
