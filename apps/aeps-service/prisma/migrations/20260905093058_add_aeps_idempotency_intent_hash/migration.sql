-- AlterTable
ALTER TABLE "AepsTransactionIdempotency" ADD COLUMN     "intent_hash" VARCHAR(64);

-- CreateIndex
CREATE INDEX "AepsTransactionIdempotency_identityId_profileId_provider_tr_idx" ON "AepsTransactionIdempotency"("identityId", "profileId", "provider", "transactionType", "intent_hash", "status");

-- CreateIndex
CREATE INDEX "AepsTransactionIdempotency_identityId_transactionType_reque_idx" ON "AepsTransactionIdempotency"("identityId", "transactionType", "requestHash", "status");
