/*
  Warnings:

  - A unique constraint covering the columns `[account_number_hash,ifsc]` on the table `user_bank_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_bank_accounts_identity_id_account_number_hash_ifsc_key";

-- CreateTable
CREATE TABLE "user_bank_status_audits" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "status_changed_by_id" TEXT NOT NULL,
    "old_status" "BankAccountStatus" NOT NULL,
    "new_status" "BankAccountStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_bank_status_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_bank_status_audits_bank_account_id_idx" ON "user_bank_status_audits"("bank_account_id");

-- CreateIndex
CREATE INDEX "user_bank_status_audits_status_changed_by_id_idx" ON "user_bank_status_audits"("status_changed_by_id");

-- CreateIndex
CREATE INDEX "user_bank_status_audits_changed_at_idx" ON "user_bank_status_audits"("changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_accounts_account_number_hash_ifsc_key" ON "user_bank_accounts"("account_number_hash", "ifsc");

-- AddForeignKey
ALTER TABLE "user_bank_status_audits" ADD CONSTRAINT "user_bank_status_audits_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "user_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank_status_audits" ADD CONSTRAINT "user_bank_status_audits_status_changed_by_id_fkey" FOREIGN KEY ("status_changed_by_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
