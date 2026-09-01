-- AlterTable
ALTER TABLE "commission" ADD COLUMN     "credited_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" VARCHAR(500),
ADD COLUMN     "wallet_transaction_id" TEXT,
ADD COLUMN     "wallet_transaction_reference" TEXT;
