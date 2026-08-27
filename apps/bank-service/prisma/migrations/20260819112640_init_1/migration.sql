-- DropForeignKey
ALTER TABLE "bank_account_verifications" DROP CONSTRAINT "bank_account_verifications_bank_account_id_fkey";

-- AlterTable
ALTER TABLE "bank_account_verifications" ALTER COLUMN "bank_account_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "bank_account_verifications" ADD CONSTRAINT "bank_account_verifications_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "user_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
