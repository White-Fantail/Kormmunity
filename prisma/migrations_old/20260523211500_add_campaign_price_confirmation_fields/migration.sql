-- Add campaign price confirmation metadata fields
ALTER TABLE "AdCampaign"
  ADD COLUMN "pricingConfirmationSnapshot" JSONB,
  ADD COLUMN "priceAdjustmentReason" TEXT,
  ADD COLUMN "priceConfirmedByUserId" TEXT,
  ADD COLUMN "priceConfirmedAt" TIMESTAMP(3);

ALTER TABLE "AdCampaign"
  ADD CONSTRAINT "AdCampaign_priceConfirmedByUserId_fkey"
  FOREIGN KEY ("priceConfirmedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdCampaign_priceConfirmedByUserId_idx" ON "AdCampaign"("priceConfirmedByUserId");
