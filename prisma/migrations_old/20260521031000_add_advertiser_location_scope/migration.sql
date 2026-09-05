-- AlterTable
ALTER TABLE "Advertiser"
ADD COLUMN "countryId" TEXT,
ADD COLUMN "cityId" TEXT;

-- CreateIndex
CREATE INDEX "Advertiser_countryId_cityId_idx" ON "Advertiser"("countryId", "cityId");

-- AddForeignKey
ALTER TABLE "Advertiser"
ADD CONSTRAINT "Advertiser_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser"
ADD CONSTRAINT "Advertiser_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
