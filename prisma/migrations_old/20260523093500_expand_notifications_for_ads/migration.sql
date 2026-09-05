-- Extend notification types for ad module events
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_PROPOSAL_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_CAMPAIGN_REVIEW_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_CAMPAIGN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AD_CAMPAIGN_CHANGES_REQUESTED';

-- Notification target entity type for domain-event style routing
CREATE TYPE "NotificationTargetType" AS ENUM ('POST', 'COMMENT', 'AD_PROPOSAL', 'AD_CAMPAIGN', 'SYSTEM');

ALTER TABLE "Notification"
  ADD COLUMN "targetType" "NotificationTargetType" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "targetUrl" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "Notification_recipientId_targetType_createdAt_idx"
  ON "Notification" ("recipientId", "targetType", "createdAt" DESC);
