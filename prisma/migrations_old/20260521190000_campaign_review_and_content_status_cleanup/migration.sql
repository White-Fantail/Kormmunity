-- Migration: Add REVIEW status to AdCampaign, add campaign review fields,
--             and remove REQUEST_CHANGES from AdContentStatus.

-- 1. Add REVIEW value to AdCampaignStatus enum
DO $$
BEGIN
  ALTER TYPE "AdCampaignStatus" ADD VALUE 'REVIEW' AFTER 'DRAFT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2. Add review columns to AdCampaign
ALTER TABLE "AdCampaign"
  ADD COLUMN IF NOT EXISTS "reviewNotes"      TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt"       TIMESTAMP(3);

-- 3. Add foreign-key index for reviewedByUserId
CREATE INDEX IF NOT EXISTS "AdCampaign_reviewedByUserId_idx"
  ON "AdCampaign"("reviewedByUserId");

-- 4. Add the FK constraint
ALTER TABLE "AdCampaign"
  ADD CONSTRAINT "AdCampaign_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Migrate any existing REQUEST_CHANGES content back to REVIEW
UPDATE "AdContent" SET status = 'REVIEW' WHERE status = 'REQUEST_CHANGES';

-- 6. Remove REQUEST_CHANGES from AdContentStatus enum.
--    PostgreSQL does not support DROP VALUE, so we rename-and-recreate.
ALTER TYPE "AdContentStatus" RENAME TO "AdContentStatus_old";

CREATE TYPE "AdContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "AdContent"
  ALTER COLUMN status TYPE "AdContentStatus"
  USING status::text::"AdContentStatus";

DROP TYPE "AdContentStatus_old";
