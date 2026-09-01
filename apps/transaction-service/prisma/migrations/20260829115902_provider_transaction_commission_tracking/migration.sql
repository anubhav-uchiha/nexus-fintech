-- CreateEnum
CREATE TYPE "ProviderCommissionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SETTLED', 'FAILED');

-- AlterTable
ALTER TABLE "provider_transactions" ADD COLUMN     "commission_amount" DECIMAL(18,2),
ADD COLUMN     "commission_failure_reason" VARCHAR(500),
ADD COLUMN     "commission_reference_id" VARCHAR(150),
ADD COLUMN     "commission_settled_at" TIMESTAMP(3),
ADD COLUMN     "commission_status" "ProviderCommissionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "commission_wallet_transaction_reference" VARCHAR(150);

-- CreateIndex
CREATE INDEX "provider_transactions_commission_status_idx" ON "provider_transactions"("commission_status");
