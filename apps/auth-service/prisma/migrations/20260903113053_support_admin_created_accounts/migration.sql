-- AlterTable
ALTER TABLE "identities" ADD COLUMN     "onboardingStatus" "AccountOnboardingStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "temporaryCredentialsExpireAt" TIMESTAMP(3),
ALTER COLUMN "phoneNumber" DROP NOT NULL,
ALTER COLUMN "aadhaarNumber" DROP NOT NULL,
ALTER COLUMN "panNumber" DROP NOT NULL,
ALTER COLUMN "shopAddress" DROP NOT NULL,
ALTER COLUMN "shopCity" DROP NOT NULL,
ALTER COLUMN "shopName" DROP NOT NULL,
ALTER COLUMN "shopState" DROP NOT NULL;
