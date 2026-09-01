-- AlterTable
ALTER TABLE "provider_transactions" ADD COLUMN     "reconciled_at" TIMESTAMP(3),
ADD COLUMN     "reconciled_by" VARCHAR(100),
ADD COLUMN     "reconciliation_note" VARCHAR(500);
