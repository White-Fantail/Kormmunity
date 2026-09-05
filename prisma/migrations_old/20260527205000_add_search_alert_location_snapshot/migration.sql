-- AlterTable
ALTER TABLE "SearchAlert"
ADD COLUMN "countryIdSnapshot" TEXT,
ADD COLUMN "cityIdSnapshot" TEXT;

-- AddForeignKey
ALTER TABLE "SearchAlert"
ADD CONSTRAINT "SearchAlert_countryIdSnapshot_fkey"
FOREIGN KEY ("countryIdSnapshot") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlert"
ADD CONSTRAINT "SearchAlert_cityIdSnapshot_fkey"
FOREIGN KEY ("cityIdSnapshot") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SearchAlert_createdAt_query_idx" ON "SearchAlert"("createdAt", "query");

-- CreateIndex
CREATE INDEX "SearchAlert_countryIdSnapshot_createdAt_idx" ON "SearchAlert"("countryIdSnapshot", "createdAt");

-- CreateIndex
CREATE INDEX "SearchAlert_cityIdSnapshot_createdAt_idx" ON "SearchAlert"("cityIdSnapshot", "createdAt");
