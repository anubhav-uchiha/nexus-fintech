-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'NEW_DEVICE_LOGIN';

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "superAdminId" TEXT,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "lastIpAddress" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "trustedUntil" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_device_challenges" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "superAdminId" TEXT,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_device_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trusted_devices_identityId_idx" ON "trusted_devices"("identityId");

-- CreateIndex
CREATE INDEX "trusted_devices_superAdminId_idx" ON "trusted_devices"("superAdminId");

-- CreateIndex
CREATE INDEX "trusted_devices_deviceId_idx" ON "trusted_devices"("deviceId");

-- CreateIndex
CREATE INDEX "trusted_devices_trustedUntil_idx" ON "trusted_devices"("trustedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_identityId_deviceId_key" ON "trusted_devices"("identityId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_superAdminId_deviceId_key" ON "trusted_devices"("superAdminId", "deviceId");

-- CreateIndex
CREATE INDEX "login_device_challenges_identityId_idx" ON "login_device_challenges"("identityId");

-- CreateIndex
CREATE INDEX "login_device_challenges_superAdminId_idx" ON "login_device_challenges"("superAdminId");

-- CreateIndex
CREATE INDEX "login_device_challenges_deviceId_idx" ON "login_device_challenges"("deviceId");

-- CreateIndex
CREATE INDEX "login_device_challenges_expiresAt_idx" ON "login_device_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_device_challenges" ADD CONSTRAINT "login_device_challenges_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_device_challenges" ADD CONSTRAINT "login_device_challenges_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
