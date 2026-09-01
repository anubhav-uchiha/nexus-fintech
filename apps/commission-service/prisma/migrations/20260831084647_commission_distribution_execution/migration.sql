-- AlterTable
ALTER TABLE "commission_distribution_transactions" ADD COLUMN     "credited_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" VARCHAR(500),
ADD COLUMN     "transaction_reference" TEXT;
