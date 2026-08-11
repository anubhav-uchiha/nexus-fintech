-- CreateEnum
CREATE TYPE "BankAccountPurpose" AS ENUM ('PAYOUT', 'DMT');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BankAccountVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankAccountOwnershipStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankAccountDocumentType" AS ENUM ('BANK_STATEMENT', 'PASSBOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

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
    "ownership_status" "BankAccountOwnershipStatus" NOT NULL DEFAULT 'PENDING',
    "purposes" "BankAccountPurpose"[],
    "status" "BankAccountStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "BankAccountVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verification_method" VARCHAR(50),
    "verified_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "blocked_at" TIMESTAMP(3),
    "blocked_by" TEXT,
    "block_reason" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_bank_account_documents" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "document_type" "BankAccountDocumentType" NOT NULL,
    "document_url" TEXT NOT NULL,
    "document_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_bank_account_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_bank_accounts_identity_id_idx" ON "user_bank_accounts"("identity_id");

-- CreateIndex
CREATE INDEX "user_bank_accounts_identity_id_status_idx" ON "user_bank_accounts"("identity_id", "status");

-- CreateIndex
CREATE INDEX "user_bank_accounts_ifsc_idx" ON "user_bank_accounts"("ifsc");

-- CreateIndex
CREATE INDEX "user_bank_accounts_account_number_hash_idx" ON "user_bank_accounts"("account_number_hash");

-- CreateIndex
CREATE INDEX "user_bank_account_documents_bank_account_id_idx" ON "user_bank_account_documents"("bank_account_id");

-- CreateIndex
CREATE INDEX "user_bank_account_documents_document_status_idx" ON "user_bank_account_documents"("document_status");

-- CreateIndex
CREATE INDEX "password_reset_drafts_identityId_idx" ON "password_reset_drafts"("identityId");

-- AddForeignKey
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank_account_documents" ADD CONSTRAINT "user_bank_account_documents_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "user_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank_account_documents" ADD CONSTRAINT "user_bank_account_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
