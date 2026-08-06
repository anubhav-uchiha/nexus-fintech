/*
  Warnings:

  - The values [PHONE_PASSWORD] on the enum `LoginMethod` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `firstName` on the `identities` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `identities` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[aadhaarNumber]` on the table `identities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[panNumber]` on the table `identities` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aadhaarNumber` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mpin` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `panNumber` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pincode` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopAddress` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopCity` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopName` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopState` to the `identities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `identities` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RegistrationStep" AS ENUM ('ROLE_SELECTED', 'PHONE_VERIFIED', 'PAN_VERIFIED', 'DETAILS_COMPLETED', 'COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "LoginMethod_new" AS ENUM ('EMAIL', 'USERNAME', 'LOGIN_ID', 'PHONENUMBER');
ALTER TABLE "public"."identities" ALTER COLUMN "preferredLoginMethod" DROP DEFAULT;
ALTER TABLE "identities" ALTER COLUMN "preferredLoginMethod" TYPE "LoginMethod_new" USING ("preferredLoginMethod"::text::"LoginMethod_new");
ALTER TYPE "LoginMethod" RENAME TO "LoginMethod_old";
ALTER TYPE "LoginMethod_new" RENAME TO "LoginMethod";
DROP TYPE "public"."LoginMethod_old";
ALTER TABLE "identities" ALTER COLUMN "preferredLoginMethod" SET DEFAULT 'LOGIN_ID';
COMMIT;

-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "identityId" TEXT;

-- AlterTable
ALTER TABLE "identities" DROP COLUMN "firstName",
DROP COLUMN "lastName",
ADD COLUMN     "aadhaarNumber" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "isPanVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mpin" TEXT NOT NULL,
ADD COLUMN     "panNumber" TEXT NOT NULL,
ADD COLUMN     "pincode" TEXT NOT NULL,
ADD COLUMN     "registrationStep" "RegistrationStep" NOT NULL DEFAULT 'ROLE_SELECTED',
ADD COLUMN     "shopAddress" TEXT NOT NULL,
ADD COLUMN     "shopCity" TEXT NOT NULL,
ADD COLUMN     "shopName" TEXT NOT NULL,
ADD COLUMN     "shopState" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL,
ALTER COLUMN "preferredLoginMethod" SET DEFAULT 'LOGIN_ID';

-- CreateTable
CREATE TABLE "registration_drafts" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "panNumber" TEXT,
    "isPanVerified" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "username" TEXT,
    "email" TEXT,
    "aadhaarNumber" TEXT,
    "shopName" TEXT,
    "shopAddress" TEXT,
    "shopCity" TEXT,
    "shopState" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "registrationStep" "RegistrationStep" NOT NULL DEFAULT 'ROLE_SELECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_drafts_phoneNumber_key" ON "registration_drafts"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "registration_drafts_panNumber_key" ON "registration_drafts"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "registration_drafts_username_key" ON "registration_drafts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "registration_drafts_email_key" ON "registration_drafts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "registration_drafts_aadhaarNumber_key" ON "registration_drafts"("aadhaarNumber");

-- CreateIndex
CREATE INDEX "registration_drafts_phoneNumber_idx" ON "registration_drafts"("phoneNumber");

-- CreateIndex
CREATE INDEX "registration_drafts_email_idx" ON "registration_drafts"("email");

-- CreateIndex
CREATE INDEX "registration_drafts_registrationStep_idx" ON "registration_drafts"("registrationStep");

-- CreateIndex
CREATE UNIQUE INDEX "identities_aadhaarNumber_key" ON "identities"("aadhaarNumber");

-- CreateIndex
CREATE UNIQUE INDEX "identities_panNumber_key" ON "identities"("panNumber");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
