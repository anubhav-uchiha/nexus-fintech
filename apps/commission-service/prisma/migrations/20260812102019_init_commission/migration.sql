-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "operator" TEXT,
    "role" TEXT NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "commissionValue" DECIMAL(18,4) NOT NULL,
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionReference" TEXT,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "operator" TEXT,
    "transactionAmount" DECIMAL(18,2) NOT NULL,
    "commissionAmount" DECIMAL(18,2) NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "ruleId" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_rules_serviceType_idx" ON "commission_rules"("serviceType");

-- CreateIndex
CREATE INDEX "commission_rules_operator_idx" ON "commission_rules"("operator");

-- CreateIndex
CREATE INDEX "commission_rules_role_idx" ON "commission_rules"("role");

-- CreateIndex
CREATE INDEX "commission_rules_isActive_idx" ON "commission_rules"("isActive");

-- CreateIndex
CREATE INDEX "commission_rules_priority_idx" ON "commission_rules"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "commission_referenceId_key" ON "commission"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_idempotencyKey_key" ON "commission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "commission_transactionId_idx" ON "commission"("transactionId");

-- CreateIndex
CREATE INDEX "commission_userId_idx" ON "commission"("userId");

-- CreateIndex
CREATE INDEX "commission_role_idx" ON "commission"("role");

-- CreateIndex
CREATE INDEX "commission_transactionReference_idx" ON "commission"("transactionReference");

-- CreateIndex
CREATE INDEX "commission_serviceType_idx" ON "commission"("serviceType");

-- CreateIndex
CREATE INDEX "commission_status_idx" ON "commission"("status");

-- CreateIndex
CREATE INDEX "commission_createdAt_idx" ON "commission"("createdAt");

-- AddForeignKey
ALTER TABLE "commission" ADD CONSTRAINT "commission_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
