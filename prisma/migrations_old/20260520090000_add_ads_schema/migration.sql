-- CreateEnum
CREATE TYPE "AdPlacementType" AS ENUM ('TOP_FIXED', 'FEED_INLINE');

-- CreateEnum
CREATE TYPE "AdSize" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "AdLayout" AS ENUM ('TEXT', 'THUMBNAIL', 'IMAGE', 'FEATURED');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdPricingModel" AS ENUM ('FIXED', 'CPM');

-- CreateTable
CREATE TABLE "AdProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placementType" "AdPlacementType" NOT NULL,
    "size" "AdSize" NOT NULL DEFAULT 'M',
    "layout" "AdLayout" NOT NULL DEFAULT 'THUMBNAIL',
    "pricingModel" "AdPricingModel" NOT NULL DEFAULT 'FIXED',
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "adProductId" TEXT NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "maxImpressions" INTEGER,
    "targetCountryId" TEXT,
    "targetCityId" TEXT,
    "landingUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacementRule" (
    "id" TEXT NOT NULL,
    "placementType" "AdPlacementType" NOT NULL,
    "insertAfter" INTEGER NOT NULL DEFAULT 5,
    "repeatInterval" INTEGER NOT NULL DEFAULT 10,
    "maxPerPage" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacementRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdImpression" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "placementType" "AdPlacementType" NOT NULL,
    "pageKey" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "viewerUserId" TEXT,
    "viewerFingerprint" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdClick" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "impressionId" TEXT,
    "viewerUserId" TEXT,
    "viewerFingerprint" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdProduct_code_key" ON "AdProduct"("code");

-- CreateIndex
CREATE INDEX "AdCampaign_status_startAt_endAt_idx" ON "AdCampaign"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "AdCampaign_adProductId_status_idx" ON "AdCampaign"("adProductId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_postId_status_idx" ON "AdCampaign"("postId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_targetCountryId_status_idx" ON "AdCampaign"("targetCountryId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_targetCityId_status_idx" ON "AdCampaign"("targetCityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlacementRule_placementType_key" ON "AdPlacementRule"("placementType");

-- CreateIndex
CREATE INDEX "AdImpression_campaignId_viewedAt_idx" ON "AdImpression"("campaignId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdImpression_postId_viewedAt_idx" ON "AdImpression"("postId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdImpression_viewedAt_idx" ON "AdImpression"("viewedAt");

-- CreateIndex
CREATE INDEX "AdClick_campaignId_clickedAt_idx" ON "AdClick"("campaignId", "clickedAt");

-- CreateIndex
CREATE INDEX "AdClick_postId_clickedAt_idx" ON "AdClick"("postId", "clickedAt");

-- CreateIndex
CREATE INDEX "AdClick_clickedAt_idx" ON "AdClick"("clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyStat_campaignId_date_key" ON "AdDailyStat"("campaignId", "date");

-- CreateIndex
CREATE INDEX "AdDailyStat_campaignId_date_idx" ON "AdDailyStat"("campaignId", "date" DESC);

-- CreateIndex
CREATE INDEX "AdDailyStat_date_idx" ON "AdDailyStat"("date" DESC);

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adProductId_fkey" FOREIGN KEY ("adProductId") REFERENCES "AdProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_targetCountryId_fkey" FOREIGN KEY ("targetCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_targetCityId_fkey" FOREIGN KEY ("targetCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
