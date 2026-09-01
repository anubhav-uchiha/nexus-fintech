-- AlterTable
ALTER TABLE "provider_transactions" ADD COLUMN     "needs_reconciliation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciliation_reason" VARCHAR(500);

-- CreateIndex
CREATE INDEX "provider_transactions_needs_reconciliation_status_idx" ON "provider_transactions"("needs_reconciliation", "status");
