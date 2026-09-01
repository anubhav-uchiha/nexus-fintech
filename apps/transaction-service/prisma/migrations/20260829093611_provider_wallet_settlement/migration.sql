-- CreateEnum
CREATE TYPE "ProviderSettlementStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RESERVED', 'SETTLED', 'COMPENSATED', 'FAILED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "provider_transactions" ADD COLUMN     "compensated_at" TIMESTAMP(3),
ADD COLUMN     "compensation_transaction_reference" VARCHAR(150),
ADD COLUMN     "reserved_at" TIMESTAMP(3),
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "settlement_failure_reason" VARCHAR(500),
ADD COLUMN     "settlement_status" "ProviderSettlementStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "settlement_transaction_reference" VARCHAR(150);

-- CreateIndex
CREATE INDEX "provider_transactions_settlement_status_idx" ON "provider_transactions"("settlement_status");
