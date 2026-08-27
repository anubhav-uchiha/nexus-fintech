-- CreateEnum
CREATE TYPE "VimopayTxnAuthType" AS ENUM ('CASH_WITHDRAWAL', 'AADHAAR_PAY');

-- CreateEnum
CREATE TYPE "VimopayTxnAuthStatus" AS ENUM ('ISSUED', 'CONSUMING', 'CONSUMED', 'EXPIRED', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "VimopayTxnAuthorization" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "type" "VimopayTxnAuthType" NOT NULL,
    "status" "VimopayTxnAuthStatus" NOT NULL DEFAULT 'ISSUED',
    "clientRefId" VARCHAR(64) NOT NULL,
    "providerTxnRefId" VARCHAR(250),
    "amount" DECIMAL(12,2) NOT NULL,
    "bankIIN" VARCHAR(20) NOT NULL,
    "aadhaarLast4" VARCHAR(4) NOT NULL,
    "providerStatusCode" VARCHAR(20),
    "providerStatusMessage" VARCHAR(500),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumingAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VimopayTxnAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VimopayTxnAuthorization_clientRefId_key" ON "VimopayTxnAuthorization"("clientRefId");

-- CreateIndex
CREATE INDEX "VimopayTxnAuthorization_profileId_status_idx" ON "VimopayTxnAuthorization"("profileId", "status");

-- CreateIndex
CREATE INDEX "VimopayTxnAuthorization_expiresAt_idx" ON "VimopayTxnAuthorization"("expiresAt");

-- CreateIndex
CREATE INDEX "VimopayTxnAuthorization_type_status_idx" ON "VimopayTxnAuthorization"("type", "status");

-- AddForeignKey
ALTER TABLE "VimopayTxnAuthorization" ADD CONSTRAINT "VimopayTxnAuthorization_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AepsMerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
