-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transactionGroupId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_transactionGroupId_idx" ON "transactions"("transactionGroupId");
