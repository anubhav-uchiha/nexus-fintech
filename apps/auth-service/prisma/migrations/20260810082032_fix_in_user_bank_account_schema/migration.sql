/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `user_bank_accounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_bank_accounts" DROP COLUMN "deletedAt",
ADD COLUMN     "deleted_at" TIMESTAMP(3);
