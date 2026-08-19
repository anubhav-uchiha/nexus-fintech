-- CreateTable
CREATE TABLE "commission_distributions" (
    "id" TEXT NOT NULL,
    "commissionRuleId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "distributionType" "CommissionType" NOT NULL,
    "distributionValue" DECIMAL(18,4) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_distributions_commissionRuleId_idx" ON "commission_distributions"("commissionRuleId");

-- CreateIndex
CREATE INDEX "commission_distributions_recipientRole_idx" ON "commission_distributions"("recipientRole");

-- CreateIndex
CREATE INDEX "commission_distributions_isActive_idx" ON "commission_distributions"("isActive");

-- CreateIndex
CREATE INDEX "commission_distributions_priority_idx" ON "commission_distributions"("priority");

-- AddForeignKey
ALTER TABLE "commission_distributions" ADD CONSTRAINT "commission_distributions_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "commission_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
