ALTER TYPE "KakaoMessageDeliveryType" ADD VALUE 'AD_PROPOSAL_SUBMITTED';
ALTER TYPE "KakaoMessageDeliveryType" ADD VALUE 'AD_CAMPAIGN_REVIEW_REQUESTED';
ALTER TYPE "KakaoMessageDeliveryType" ADD VALUE 'AD_CAMPAIGN_APPROVED';
ALTER TYPE "KakaoMessageDeliveryType" ADD VALUE 'AD_CAMPAIGN_CHANGES_REQUESTED';

ALTER TABLE "KakaoMessageDelivery"
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "KakaoMessageDelivery_dedupeKey_key"
ON "KakaoMessageDelivery"("dedupeKey");
