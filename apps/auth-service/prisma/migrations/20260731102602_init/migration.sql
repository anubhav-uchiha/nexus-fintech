-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LoginMethod" AS ENUM ('EMAIL', 'USERNAME', 'LOGIN_ID', 'PHONE_PASSWORD');

-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'FORGOT_PASSWORD', 'CHANGE_EMAIL', 'CHANGE_PHONE', 'TRANSACTION');

-- CreateTable
CREATE TABLE "identities" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLoginMethod" "LoginMethod" NOT NULL DEFAULT 'EMAIL',
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identities_loginId_key" ON "identities"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "identities_username_key" ON "identities"("username");

-- CreateIndex
CREATE UNIQUE INDEX "identities_email_key" ON "identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "identities_phoneNumber_key" ON "identities"("phoneNumber");

-- CreateIndex
CREATE INDEX "identities_email_idx" ON "identities"("email");

-- CreateIndex
CREATE INDEX "identities_username_idx" ON "identities"("username");

-- CreateIndex
CREATE INDEX "identities_phoneNumber_idx" ON "identities"("phoneNumber");

-- CreateIndex
CREATE INDEX "identities_roleId_idx" ON "identities"("roleId");

-- CreateIndex
CREATE INDEX "identities_preferredLoginMethod_idx" ON "identities"("preferredLoginMethod");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "Otp_phoneNumber_idx" ON "Otp"("phoneNumber");

-- CreateIndex
CREATE INDEX "Otp_email_idx" ON "Otp"("email");

-- CreateIndex
CREATE INDEX "Otp_purpose_idx" ON "Otp"("purpose");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
