/*
  Warnings:

  - You are about to drop the column `verification_method` on the `user_bank_accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[identity_id,account_number_hash,ifsc]` on the table `user_bank_accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,identity_id]` on the table `user_bank_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_bank_accounts_account_number_hash_idx";

-- DropIndex
DROP INDEX "user_bank_accounts_identity_id_idx";

-- DropIndex
DROP INDEX "user_bank_accounts_ifsc_idx";

-- AlterTable
ALTER TABLE "user_bank_accounts" DROP COLUMN "verification_method";

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_accounts_identity_id_account_number_hash_ifsc_key" ON "user_bank_accounts"("identity_id", "account_number_hash", "ifsc");

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_accounts_id_identity_id_key" ON "user_bank_accounts"("id", "identity_id");
