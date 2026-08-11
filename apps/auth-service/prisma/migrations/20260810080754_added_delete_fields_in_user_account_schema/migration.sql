-- AlterTable
ALTER TABLE "user_bank_accounts" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;
