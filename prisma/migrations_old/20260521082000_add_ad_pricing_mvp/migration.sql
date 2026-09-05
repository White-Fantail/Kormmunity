-- CreateEnum
CREATE TYPE "AdBillingUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'IMPRESSION_1000');

-- CreateEnum
CREATE TYPE "AdBillingStatus" AS ENUM ('DRAFT', 'ESTIMATED', 'INVOICED', 'PAID', 'WAIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AdProduct"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NZD',
ADD COLUMN "billingUnit" "AdBillingUnit" NOT NULL DEFAULT 'DAY';

-- AlterTable
ALTER TABLE "AdCampaign"
ADD COLUMN "estimatedAmount" DECIMAL(10,2),
ADD COLUMN "finalAmount" DECIMAL(10,2),
ADD COLUMN "billingStatus" "AdBillingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "pricingSnapshot" JSONB;

-- CreateTable
CREATE TABLE "AdGeoPricing" (
    "id" TEXT NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "multiplier" DECIMAL(8,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdGeoPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacementPricing" (
    "id" TEXT NOT NULL,
    "placementType" "AdPlacementType" NOT NULL,
    "multiplier" DECIMAL(8,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacementPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdGeoPricing_cityId_isActive_effectiveFrom_effectiveTo_idx" ON "AdGeoPricing"("cityId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "AdGeoPricing_countryId_isActive_effectiveFrom_effectiveTo_idx" ON "AdGeoPricing"("countryId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "AdPlacementPricing_lookup_idx" ON "AdPlacementPricing"("placementType", "isActive", "effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "AdGeoPricing" ADD CONSTRAINT "AdGeoPricing_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGeoPricing" ADD CONSTRAINT "AdGeoPricing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
