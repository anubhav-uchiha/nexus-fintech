-- AlterTable
ALTER TABLE "commission" ADD COLUMN     "reversal_reason" VARCHAR(500),
ADD COLUMN     "reversed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "commission_distribution_transactions" ADD COLUMN     "reversal_failure_reason" VARCHAR(500),
ADD COLUMN     "reversal_transaction_id" TEXT,
ADD COLUMN     "reversal_transaction_reference" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMP(3);
