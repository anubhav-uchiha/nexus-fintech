-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "identityId" UUID,
    "sessionId" UUID,
    "loginId" VARCHAR(50),
    "role" VARCHAR(50),
    "service" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "httpMethod" VARCHAR(10),
    "endpoint" VARCHAR(500),
    "statusCode" INTEGER,
    "ipAddress" VARCHAR(45),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_eventId_key" ON "audit_logs"("eventId");

-- CreateIndex
CREATE INDEX "audit_logs_identityId_createdAt_idx" ON "audit_logs"("identityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_service_createdAt_idx" ON "audit_logs"("service", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
