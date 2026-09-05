-- Add sourcedByUserId to AdCampaign
ALTER TABLE "AdCampaign" ADD COLUMN "sourcedByUserId" TEXT;

CREATE INDEX "AdCampaign_sourcedByUserId_status_idx" ON "AdCampaign"("sourcedByUserId", "status");

ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_sourcedByUserId_fkey"
  FOREIGN KEY ("sourcedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add PartnerIncentiveStatus enum
CREATE TYPE "PartnerIncentiveStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID');

-- Create PartnerIncentive table
CREATE TABLE "PartnerIncentive" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalSalesAmount" DECIMAL(10,2) NOT NULL,
    "incentiveRate" DECIMAL(8,4) NOT NULL,
    "incentiveAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "status" "PartnerIncentiveStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "paidByUserId" TEXT,
    "campaignSnapshots" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerIncentive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerIncentive_partnerUserId_status_idx" ON "PartnerIncentive"("partnerUserId", "status");
CREATE INDEX "PartnerIncentive_partnerUserId_periodStart_periodEnd_idx" ON "PartnerIncentive"("partnerUserId", "periodStart", "periodEnd");
CREATE INDEX "PartnerIncentive_status_createdAt_idx" ON "PartnerIncentive"("status", "createdAt" DESC);

ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_partnerUserId_fkey"
  FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_paidByUserId_fkey"
  FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
