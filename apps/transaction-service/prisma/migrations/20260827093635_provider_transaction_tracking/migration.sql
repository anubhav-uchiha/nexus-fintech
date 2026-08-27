-- CreateEnum
CREATE TYPE "ProviderTransactionStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'PENDING', 'UNKNOWN', 'REVERSED');

-- CreateTable
CREATE TABLE "provider_transactions" (
    "id" UUID NOT NULL,
    "reference_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ProviderTransactionStatus" NOT NULL DEFAULT 'INITIATED',
    "idempotency_key" VARCHAR(100),
    "merchant_profile_id" UUID,
    "provider_merchant_id" VARCHAR(100),
    "provider_merchant_ref_id" VARCHAR(100),
    "provider_txn_ref_id" VARCHAR(150),
    "rrn" VARCHAR(50),
    "npci_code" VARCHAR(20),
    "npci_message" VARCHAR(250),
    "provider_status_code" VARCHAR(20),
    "provider_status_message" VARCHAR(500),
    "bank_iin" VARCHAR(30),
    "aadhaar_last4" VARCHAR(4),
    "metadata" JSONB,
    "provider_called_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_transactions_reference_id_key" ON "provider_transactions"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_transactions_idempotency_key_key" ON "provider_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "provider_transactions_user_id_created_at_idx" ON "provider_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_transactions_service_type_provider_idx" ON "provider_transactions"("service_type", "provider");

-- CreateIndex
CREATE INDEX "provider_transactions_provider_operation_idx" ON "provider_transactions"("provider", "operation");

-- CreateIndex
CREATE INDEX "provider_transactions_status_idx" ON "provider_transactions"("status");

-- CreateIndex
CREATE INDEX "provider_transactions_provider_merchant_ref_id_idx" ON "provider_transactions"("provider_merchant_ref_id");

-- CreateIndex
CREATE INDEX "provider_transactions_provider_txn_ref_id_idx" ON "provider_transactions"("provider_txn_ref_id");

-- CreateIndex
CREATE INDEX "provider_transactions_rrn_idx" ON "provider_transactions"("rrn");
