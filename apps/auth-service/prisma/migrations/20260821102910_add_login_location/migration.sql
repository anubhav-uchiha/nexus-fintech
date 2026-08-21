-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "latitude" DECIMAL(8,6),
ADD COLUMN     "locationAccuracy" DOUBLE PRECISION,
ADD COLUMN     "locationCapturedAt" TIMESTAMP(3),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "identities" ADD COLUMN     "lastLoginLatitude" DECIMAL(8,6),
ADD COLUMN     "lastLoginLongitude" DECIMAL(9,6);
