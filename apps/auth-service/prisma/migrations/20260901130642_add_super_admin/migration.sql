-- CreateEnum
CREATE TYPE "AccountOnboardingStatus" AS ENUM ('CREDENTIALS_ISSUED', 'PHONE_PENDING', 'PAN_PENDING', 'CREDENTIAL_CHANGE_REQUIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "super_admins" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "mpin" TEXT NOT NULL,
    "aadhaarNumber" TEXT,
    "panNumber" TEXT,
    "shopName" TEXT,
    "shopAddress" TEXT,
    "shopCity" TEXT,
    "shopState" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPanVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLoginMethod" "LoginMethod" NOT NULL DEFAULT 'LOGIN_ID',
    "onboardingStatus" "AccountOnboardingStatus" NOT NULL DEFAULT 'CREDENTIALS_ISSUED',
    "temporaryCredentialsExpireAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "mpinChangedAt" TIMESTAMP(3),
    "lastLoginLatitude" DECIMAL(8,6),
    "lastLoginLongitude" DECIMAL(9,6),
    "roleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdBySuperAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_loginId_key" ON "super_admins"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_username_key" ON "super_admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_phoneNumber_key" ON "super_admins"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_aadhaarNumber_key" ON "super_admins"("aadhaarNumber");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_panNumber_key" ON "super_admins"("panNumber");

-- CreateIndex
CREATE INDEX "super_admins_email_idx" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "super_admins_username_idx" ON "super_admins"("username");

-- CreateIndex
CREATE INDEX "super_admins_phoneNumber_idx" ON "super_admins"("phoneNumber");

-- CreateIndex
CREATE INDEX "super_admins_roleId_idx" ON "super_admins"("roleId");

-- CreateIndex
CREATE INDEX "super_admins_preferredLoginMethod_idx" ON "super_admins"("preferredLoginMethod");

-- CreateIndex
CREATE INDEX "super_admins_onboardingStatus_idx" ON "super_admins"("onboardingStatus");

-- CreateIndex
CREATE INDEX "super_admins_createdBySuperAdminId_idx" ON "super_admins"("createdBySuperAdminId");

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_createdBySuperAdminId_fkey" FOREIGN KEY ("createdBySuperAdminId") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
