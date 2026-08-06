-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SIGNATURE', 'PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'SHOP_FRONT', 'BUSINESS_PROOF', 'VIDEO_VERIFICATION');

-- CreateTable
CREATE TABLE "kyc" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_video_verifications" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_video_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_identityId_key" ON "kyc"("identityId");

-- CreateIndex
CREATE INDEX "kyc_identityId_idx" ON "kyc"("identityId");

-- CreateIndex
CREATE INDEX "kyc_documents_kycId_idx" ON "kyc_documents"("kycId");

-- CreateIndex
CREATE INDEX "kyc_documents_documentType_idx" ON "kyc_documents"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_kycId_documentType_key" ON "kyc_documents"("kycId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_video_verifications_kycId_key" ON "kyc_video_verifications"("kycId");

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "kyc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_video_verifications" ADD CONSTRAINT "kyc_video_verifications_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "kyc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
