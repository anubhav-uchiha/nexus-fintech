-- CreateTable
CREATE TABLE "commission_distribution_transactions" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "distributionId" TEXT,
    "sourceUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "walletType" TEXT NOT NULL DEFAULT 'PROFIT',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_distribution_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_hierarchies" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "parentRole" TEXT NOT NULL,
    "childUserId" TEXT NOT NULL,
    "childRole" TEXT NOT NULL,
    "serviceType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_hierarchies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commission_distribution_transactions_idempotencyKey_key" ON "commission_distribution_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_commissionId_idx" ON "commission_distribution_transactions"("commissionId");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_distributionId_idx" ON "commission_distribution_transactions"("distributionId");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_sourceUserId_idx" ON "commission_distribution_transactions"("sourceUserId");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_transactionId_idx" ON "commission_distribution_transactions"("transactionId");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_recipientUserId_idx" ON "commission_distribution_transactions"("recipientUserId");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_recipientRole_idx" ON "commission_distribution_transactions"("recipientRole");

-- CreateIndex
CREATE INDEX "commission_distribution_transactions_status_idx" ON "commission_distribution_transactions"("status");

-- CreateIndex
CREATE INDEX "commission_hierarchies_parentUserId_idx" ON "commission_hierarchies"("parentUserId");

-- CreateIndex
CREATE INDEX "commission_hierarchies_parentRole_idx" ON "commission_hierarchies"("parentRole");

-- CreateIndex
CREATE INDEX "commission_hierarchies_childUserId_idx" ON "commission_hierarchies"("childUserId");

-- CreateIndex
CREATE INDEX "commission_hierarchies_childRole_idx" ON "commission_hierarchies"("childRole");

-- CreateIndex
CREATE INDEX "commission_hierarchies_serviceType_idx" ON "commission_hierarchies"("serviceType");

-- CreateIndex
CREATE INDEX "commission_hierarchies_isActive_idx" ON "commission_hierarchies"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "commission_hierarchies_parentUserId_childUserId_serviceType_key" ON "commission_hierarchies"("parentUserId", "childUserId", "serviceType");

-- AddForeignKey
ALTER TABLE "commission_distribution_transactions" ADD CONSTRAINT "commission_distribution_transactions_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_distribution_transactions" ADD CONSTRAINT "commission_distribution_transactions_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "commission_distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
