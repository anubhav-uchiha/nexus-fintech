/*
  Warnings:

  - You are about to drop the column `approved_at` on the `user_bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `approved_by` on the `user_bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `block_reason` on the `user_bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `blocked_at` on the `user_bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `blocked_by` on the `user_bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `rejection_reason` on the `user_bank_accounts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_bank_accounts" DROP CONSTRAINT "user_bank_accounts_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "user_bank_accounts" DROP CONSTRAINT "user_bank_accounts_blocked_by_fkey";

-- AlterTable
ALTER TABLE "user_bank_accounts" DROP COLUMN "approved_at",
DROP COLUMN "approved_by",
DROP COLUMN "block_reason",
DROP COLUMN "blocked_at",
DROP COLUMN "blocked_by",
DROP COLUMN "rejection_reason";
