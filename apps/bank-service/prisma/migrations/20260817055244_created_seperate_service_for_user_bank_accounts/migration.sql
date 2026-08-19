-- CreateEnum
CREATE TYPE "BankAccountPurpose" AS ENUM ('PAYOUT', 'DMT');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BankAccountVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankAccountOwnershipStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('SAVINGS', 'CURRENT', 'SALARY');

-- CreateTable
CREATE TABLE "user_bank_accounts" (
    "id" UUID NOT NULL,
    "identity_id" TEXT NOT NULL,
    "bank_name" VARCHAR(150) NOT NULL,
    "bank_code" VARCHAR(50),
    "ifsc" VARCHAR(20) NOT NULL,
    "branch_name" VARCHAR(150),
    "account_holder_name" VARCHAR(150) NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_number_hash" TEXT NOT NULL,
    "account_number_last4" VARCHAR(4) NOT NULL,
    "account_type" "BankAccountType" NOT NULL,
    "ownership_status" "BankAccountOwnershipStatus" NOT NULL DEFAULT 'PENDING',
    "purposes" "BankAccountPurpose"[],
    "status" "BankAccountStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "BankAccountVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_bank_accounts_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "user_bank_accounts_identity_id_status_idx" ON "user_bank_accounts"("identity_id", "status");

-- CreateIndex
CREATE INDEX "user_bank_accounts_id_identity_id_idx" ON "user_bank_accounts"("id", "identity_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_bank_accounts_account_number_hash_ifsc_key" ON "user_bank_accounts"("account_number_hash", "ifsc");

-- CreateIndex
CREATE INDEX "user_bank_status_audits_bank_account_id_idx" ON "user_bank_status_audits"("bank_account_id");

-- CreateIndex
CREATE INDEX "user_bank_status_audits_status_changed_by_id_idx" ON "user_bank_status_audits"("status_changed_by_id");

-- CreateIndex
CREATE INDEX "user_bank_status_audits_changed_at_idx" ON "user_bank_status_audits"("changed_at");

-- AddForeignKey
ALTER TABLE "user_bank_status_audits" ADD CONSTRAINT "user_bank_status_audits_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "user_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
