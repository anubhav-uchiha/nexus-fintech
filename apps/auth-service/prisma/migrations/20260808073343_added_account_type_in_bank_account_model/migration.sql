/*
  Warnings:

  - Added the required column `account_type` to the `user_bank_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('SAVINGS', 'CURRENT', 'SALARY');

-- AlterTable
ALTER TABLE "user_bank_accounts" ADD COLUMN     "account_type" "BankAccountType" NOT NULL;
