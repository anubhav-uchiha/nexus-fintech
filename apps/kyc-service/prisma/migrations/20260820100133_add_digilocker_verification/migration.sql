-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('MANUAL_UPLOAD', 'DIGILOCKER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('NOT_VERIFIED', 'PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "DigiLockerSessionStatus" AS ENUM ('INITIATED', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'AADHAAR';

-- AlterTable
ALTER TABLE "kyc_documents" ADD COLUMN     "digilockerSessionId" TEXT,
ADD COLUMN     "providerDocumentType" TEXT,
ADD COLUMN     "providerDocumentUri" TEXT,
ADD COLUMN     "providerIssuedAt" TIMESTAMP(3),
ADD COLUMN     "providerIssuerId" TEXT,
ADD COLUMN     "providerIssuerName" TEXT,
ADD COLUMN     "source" "DocumentSource" NOT NULL DEFAULT 'MANUAL_UPLOAD',
ADD COLUMN     "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "digilocker_verification_sessions" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "status" "DigiLockerSessionStatus" NOT NULL DEFAULT 'INITIATED',
    "requestedDocumentTypes" "DocumentType"[],
    "requestedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentGrantedAt" TIMESTAMP(3),
    "callbackReceivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digilocker_verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digilocker_verification_sessions_stateHash_key" ON "digilocker_verification_sessions"("stateHash");

-- CreateIndex
CREATE INDEX "digilocker_verification_sessions_kycId_status_idx" ON "digilocker_verification_sessions"("kycId", "status");

-- CreateIndex
CREATE INDEX "digilocker_verification_sessions_expiresAt_idx" ON "digilocker_verification_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "kyc_documents_source_verificationStatus_idx" ON "kyc_documents"("source", "verificationStatus");

-- CreateIndex
CREATE INDEX "kyc_documents_digilockerSessionId_idx" ON "kyc_documents"("digilockerSessionId");

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_digilockerSessionId_fkey" FOREIGN KEY ("digilockerSessionId") REFERENCES "digilocker_verification_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digilocker_verification_sessions" ADD CONSTRAINT "digilocker_verification_sessions_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "kyc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
