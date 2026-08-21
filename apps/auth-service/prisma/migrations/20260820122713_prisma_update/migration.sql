/*
  Warnings:

  - You are about to drop the `user_bank_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_bank_status_audits` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_bank_accounts" DROP CONSTRAINT "user_bank_accounts_identity_id_fkey";

-- DropForeignKey
ALTER TABLE "user_bank_status_audits" DROP CONSTRAINT "user_bank_status_audits_bank_account_id_fkey";

-- DropForeignKey
ALTER TABLE "user_bank_status_audits" DROP CONSTRAINT "user_bank_status_audits_status_changed_by_id_fkey";

-- DropTable
DROP TABLE "user_bank_accounts";

-- DropTable
DROP TABLE "user_bank_status_audits";

-- DropEnum
DROP TYPE "BankAccountOwnershipStatus";

-- DropEnum
DROP TYPE "BankAccountPurpose";

-- DropEnum
DROP TYPE "BankAccountStatus";

-- DropEnum
DROP TYPE "BankAccountType";

-- DropEnum
DROP TYPE "BankAccountVerificationStatus";
