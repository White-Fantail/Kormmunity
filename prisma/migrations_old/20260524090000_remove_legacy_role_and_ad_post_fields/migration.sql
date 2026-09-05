-- Ensure campaign data has been backfilled from legacy post linkage.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AdCampaign"
    WHERE "postId" IS NOT NULL
      AND "adContentId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Legacy campaign rows remain (postId without adContentId). Run `npm run ads:backfill-content` before migration.';
  END IF;
END
$$;

-- Backfill StaffAssignment from legacy User.role (scope-aware).
UPDATE "StaffAssignment" sa
SET "isActive" = true,
    "updatedAt" = NOW()
FROM "User" u
WHERE u.id = sa."userId"
  AND u.role IN ('ADMIN', 'MODERATOR', 'COORDINATOR')
  AND sa.role = u.role::"StaffRole"
  AND sa."countryId" IS NOT DISTINCT FROM u."countryId"
  AND sa."cityId" IS NOT DISTINCT FROM u."cityId"
  AND sa."isActive" = false;

INSERT INTO "StaffAssignment" ("userId", "role", "countryId", "cityId", "isActive", "createdAt", "updatedAt")
SELECT
  u.id,
  u.role::"StaffRole",
  u."countryId",
  u."cityId",
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE u.role IN ('ADMIN', 'MODERATOR', 'COORDINATOR')
  AND NOT EXISTS (
    SELECT 1
    FROM "StaffAssignment" sa
    WHERE sa."userId" = u.id
      AND sa.role = u.role::"StaffRole"
      AND sa."isActive" = true
      AND sa."countryId" IS NOT DISTINCT FROM u."countryId"
      AND sa."cityId" IS NOT DISTINCT FROM u."cityId"
  );

-- Backfill adContentId to tracking rows via campaign before making the column required.
UPDATE "AdImpression" ai
SET "adContentId" = c."adContentId"
FROM "AdCampaign" c
WHERE ai."campaignId" = c.id
  AND ai."adContentId" IS NULL
  AND c."adContentId" IS NOT NULL;

UPDATE "AdClick" ac
SET "adContentId" = c."adContentId"
FROM "AdCampaign" c
WHERE ac."campaignId" = c.id
  AND ac."adContentId" IS NULL
  AND c."adContentId" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AdImpression" WHERE "adContentId" IS NULL) THEN
    RAISE EXCEPTION 'AdImpression has rows without adContentId.';
  END IF;
  IF EXISTS (SELECT 1 FROM "AdClick" WHERE "adContentId" IS NULL) THEN
    RAISE EXCEPTION 'AdClick has rows without adContentId.';
  END IF;
END
$$;

ALTER TABLE "AdImpression"
  ALTER COLUMN "adContentId" SET NOT NULL;

ALTER TABLE "AdClick"
  ALTER COLUMN "adContentId" SET NOT NULL;

ALTER TABLE "AdCampaign"
  DROP COLUMN "postId";

ALTER TABLE "AdImpression"
  DROP COLUMN "postId";

ALTER TABLE "AdClick"
  DROP COLUMN "postId";

ALTER TABLE "User"
  DROP COLUMN "role";
