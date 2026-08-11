/*
  Warnings:

  - You are about to drop the `user_bank_account_documents` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_bank_account_documents" DROP CONSTRAINT "user_bank_account_documents_bank_account_id_fkey";

-- DropForeignKey
ALTER TABLE "user_bank_account_documents" DROP CONSTRAINT "user_bank_account_documents_reviewed_by_fkey";

-- DropTable
DROP TABLE "user_bank_account_documents";

-- DropEnum
DROP TYPE "BankAccountDocumentType";

-- DropEnum
DROP TYPE "DocumentVerificationStatus";
