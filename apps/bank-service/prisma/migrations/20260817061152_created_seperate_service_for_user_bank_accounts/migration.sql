-- CreateIndex
CREATE INDEX "user_bank_accounts_identity_id_is_deleted_idx" ON "user_bank_accounts"("identity_id", "is_deleted");
