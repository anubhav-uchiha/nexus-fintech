/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_income_external_reference]` on the table `provider_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "provider_transactions_provider_income_external_reference_idx";

-- CreateIndex
CREATE UNIQUE INDEX "provider_transactions_provider_provider_income_external_ref_key" ON "provider_transactions"("provider", "provider_income_external_reference");
