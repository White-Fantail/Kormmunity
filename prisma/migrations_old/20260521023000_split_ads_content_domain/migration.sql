-- CreateEnum
CREATE TYPE "AdvertiserMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AdProposalStatus" AS ENUM ('SUBMITTED', 'IN_NEGOTIATION', 'NEGOTIATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AdCampaign" ADD COLUMN "advertiserId" TEXT,
ADD COLUMN "adContentId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdImpression" ADD COLUMN "adContentId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdClick" ADD COLUMN "adContentId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserMember" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdvertiserMemberRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertiserMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdProposal" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "negotiatedByUserId" TEXT,
    "status" "AdProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestedStartAt" TIMESTAMP(3),
    "requestedEndAt" TIMESTAMP(3),
    "requestedBudget" DECIMAL(10,2),
    "requestedLandingUrl" TEXT,
    "negotiationNotes" TEXT,
    "rejectedReason" TEXT,
    "advertisedProductCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdContent" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "proposalId" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "status" "AdContentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "landingUrl" TEXT,
    "displayName" TEXT,
    "categoryName" TEXT,
    "cityName" TEXT,
    "reviewNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "advertiserId" TEXT,
    "proposalId" TEXT,
    "adContentId" TEXT,
    "campaignId" TEXT,
    "actionType" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_slug_key" ON "Advertiser"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserMember_advertiserId_userId_key" ON "AdvertiserMember"("advertiserId", "userId");

-- CreateIndex
CREATE INDEX "AdvertiserMember_userId_isActive_idx" ON "AdvertiserMember"("userId", "isActive");

-- CreateIndex
CREATE INDEX "AdvertiserMember_advertiserId_role_isActive_idx" ON "AdvertiserMember"("advertiserId", "role", "isActive");

-- CreateIndex
CREATE INDEX "AdProposal_advertiserId_status_createdAt_idx" ON "AdProposal"("advertiserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdProposal_status_updatedAt_idx" ON "AdProposal"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdContent_proposalId_key" ON "AdContent"("proposalId");

-- CreateIndex
CREATE INDEX "AdContent_advertiserId_status_createdAt_idx" ON "AdContent"("advertiserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdContent_status_updatedAt_idx" ON "AdContent"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AdCampaign_status_startAt_endAt_targetCountryId_targetCityId_idx" ON "AdCampaign"("status", "startAt", "endAt", "targetCountryId", "targetCityId");

-- CreateIndex
CREATE INDEX "AdCampaign_advertiserId_status_idx" ON "AdCampaign"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_adContentId_status_idx" ON "AdCampaign"("adContentId", "status");

-- CreateIndex
CREATE INDEX "AdImpression_adContentId_viewedAt_idx" ON "AdImpression"("adContentId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdClick_adContentId_clickedAt_idx" ON "AdClick"("adContentId", "clickedAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_campaignId_createdAt_idx" ON "AdAuditLog"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_proposalId_createdAt_idx" ON "AdAuditLog"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_adContentId_createdAt_idx" ON "AdAuditLog"("adContentId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_advertiserId_createdAt_idx" ON "AdAuditLog"("advertiserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adContentId_fkey" FOREIGN KEY ("adContentId") REFERENCES "AdContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserMember" ADD CONSTRAINT "AdvertiserMember_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserMember" ADD CONSTRAINT "AdvertiserMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdProposal" ADD CONSTRAINT "AdProposal_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdProposal" ADD CONSTRAINT "AdProposal_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdProposal" ADD CONSTRAINT "AdProposal_negotiatedByUserId_fkey" FOREIGN KEY ("negotiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdContent" ADD CONSTRAINT "AdContent_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdContent" ADD CONSTRAINT "AdContent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AdProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdContent" ADD CONSTRAINT "AdContent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdContent" ADD CONSTRAINT "AdContent_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAuditLog" ADD CONSTRAINT "AdAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAuditLog" ADD CONSTRAINT "AdAuditLog_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAuditLog" ADD CONSTRAINT "AdAuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AdProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAuditLog" ADD CONSTRAINT "AdAuditLog_adContentId_fkey" FOREIGN KEY ("adContentId") REFERENCES "AdContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAuditLog" ADD CONSTRAINT "AdAuditLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
