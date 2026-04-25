-- AlterTable
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "brand" TEXT;
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "model" TEXT;
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "retailer" TEXT;
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "shippingCents" INTEGER;
ALTER TABLE "AvailabilitySnapshot" ADD COLUMN "totalPriceCents" INTEGER;
