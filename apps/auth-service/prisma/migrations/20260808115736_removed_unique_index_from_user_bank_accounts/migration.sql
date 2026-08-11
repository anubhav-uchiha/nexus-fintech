-- DropIndex
DROP INDEX "user_bank_accounts_id_identity_id_key";

-- CreateIndex
CREATE INDEX "user_bank_accounts_id_identity_id_idx" ON "user_bank_accounts"("id", "identity_id");
