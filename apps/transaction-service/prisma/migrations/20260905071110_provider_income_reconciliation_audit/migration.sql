-- AlterTable
ALTER TABLE "provider_transactions" ADD COLUMN     "provider_income_external_reference" VARCHAR(150),
ADD COLUMN     "provider_income_reconciled_at" TIMESTAMP(3),
ADD COLUMN     "provider_income_reconciled_by" VARCHAR(100),
ADD COLUMN     "provider_income_source" VARCHAR(50);

-- CreateIndex
CREATE INDEX "provider_transactions_provider_income_external_reference_idx" ON "provider_transactions"("provider_income_external_reference");
