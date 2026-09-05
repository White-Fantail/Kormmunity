-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('REAL_USER', 'PERSONA', 'OPERATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LIMITED', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HELD', 'DELETED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PUBLISHED', 'HELD', 'DELETED');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('GENERAL', 'QUESTION', 'SALE', 'GIVEAWAY', 'RECRUIT', 'HOUSING', 'SERVICE', 'EVENT', 'COLUMN', 'ADVERTISEMENT', 'NOTICE');

-- CreateEnum
CREATE TYPE "CategoryVisibilityMode" AS ENUM ('NORMAL', 'ALWAYS_INCLUDED', 'HIDDEN', 'OPERATOR_BOARD', 'OPERATOR_NOTICE');

-- CreateEnum
CREATE TYPE "PermissionSubjectType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "KakaoMessageDeliveryType" AS ENUM ('SEARCH_ALERT', 'COMMENT_NOTIFICATION', 'AD_PROPOSAL_SUBMITTED', 'AD_CAMPAIGN_REVIEW_REQUESTED', 'AD_CAMPAIGN_APPROVED', 'AD_CAMPAIGN_CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POST_LIKE', 'COMMENT_CREATED', 'COMMENT_LIKE', 'BEST_COMMENT_SELECTED', 'POST_HELD', 'COMMENT_HELD', 'AD_PROPOSAL_SUBMITTED', 'AD_CAMPAIGN_REVIEW_REQUESTED', 'AD_CAMPAIGN_APPROVED', 'AD_CAMPAIGN_CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('POST', 'COMMENT', 'AD_PROPOSAL', 'AD_CAMPAIGN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "KakaoMessageDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportReviewStatus" AS ENUM ('PENDING', 'VALID', 'FALSE_REPORT');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MODERATOR', 'COORDINATOR', 'AD_MANAGER', 'PARTNER_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LocationChangeType" AS ENUM ('CITY_CHANGED', 'COUNTRY_CHANGED_CITY_RESET', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "AdPlacementType" AS ENUM ('TOP_FIXED', 'FEED_INLINE');

-- CreateEnum
CREATE TYPE "AdSize" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "AdLayout" AS ENUM ('TEXT', 'THUMBNAIL', 'IMAGE', 'FEATURED');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REQUEST_CHANGES', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdBillingUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'IMPRESSION_1000');

-- CreateEnum
CREATE TYPE "AdBillingStatus" AS ENUM ('DRAFT', 'ESTIMATED', 'INVOICED', 'PAID', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdvertiserMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AdProposalStatus" AS ENUM ('SUBMITTED', 'IN_NEGOTIATION', 'NEGOTIATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerIncentiveStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "kakaoId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "shortBio" TEXT,
    "neighbourWarmth" DOUBLE PRECISION NOT NULL DEFAULT 36.5,
    "kakaoAccessToken" TEXT,
    "kakaoRefreshToken" TEXT,
    "kakaoAccessTokenExpiresAt" TIMESTAMP(3),
    "openChatUrl" TEXT,
    "cityId" TEXT,
    "countryId" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'REAL_USER',
    "isManagedAccount" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "personaNotes" TEXT,
    "toneNotes" TEXT,
    "activityNotes" TEXT,
    "notifyOnKakaoForSearchAlert" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnKakaoForComment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "countryId" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'GENERAL',
    "visibilityMode" "CategoryVisibilityMode" NOT NULL DEFAULT 'NORMAL',
    "color" TEXT,
    "requireCommentBeforeContactDefault" BOOLEAN NOT NULL DEFAULT false,
    "contactSectionDefaultExpanded" BOOLEAN NOT NULL DEFAULT false,
    "quickCommentTemplates" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTagOption" (
    "id" TEXT NOT NULL,
    "categoryType" "CategoryType" NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTagOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPermission" (
    "id" TEXT NOT NULL,
    "subjectType" "PermissionSubjectType" NOT NULL,
    "userId" TEXT,
    "role" "UserRole",
    "countryId" TEXT,
    "cityId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "cityId" TEXT,
    "countryId" TEXT,
    "categoryId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "communityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "requireCommentBeforeContact" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "heldReason" TEXT,
    "deletedReason" TEXT,
    "contactUrl" TEXT,
    "bestCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "heldAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "postTagOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","postTagOptionId")
);

-- CreateTable
CREATE TABLE "SavedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "fingerprint" TEXT,
    "windowKey" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageViewDailyStat" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageViewDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "additionalReason" TEXT,
    "reviewStatus" "ReportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "additionalReason" TEXT,
    "reviewStatus" "ReportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPublicId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "communityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedByAdminId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "countryIdSnapshot" TEXT,
    "cityIdSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KakaoMessageDelivery" (
    "id" TEXT NOT NULL,
    "deliveryType" "KakaoMessageDeliveryType" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "messageText" TEXT NOT NULL,
    "targetUrl" TEXT,
    "status" "KakaoMessageDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "relatedPostId" TEXT,
    "searchQuery" TEXT,
    "retriedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KakaoMessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityScoreEvent" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "actorId" TEXT,
    "baseDelta" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "finalDelta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedPostId" TEXT,
    "relatedCommentId" TEXT,
    "targetType" "NotificationTargetType" NOT NULL DEFAULT 'SYSTEM',
    "targetId" TEXT,
    "targetUrl" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "NeighbourWarmthLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "baseDelta" DOUBLE PRECISION NOT NULL,
    "actualDelta" DOUBLE PRECISION NOT NULL,
    "previousWarmth" DOUBLE PRECISION NOT NULL,
    "newWarmth" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NeighbourWarmthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "changeType" "LocationChangeType" NOT NULL,
    "beforeCountryId" TEXT,
    "afterCountryId" TEXT,
    "beforeCityId" TEXT,
    "afterCityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placementType" "AdPlacementType" NOT NULL,
    "size" "AdSize" NOT NULL DEFAULT 'M',
    "layout" "AdLayout" NOT NULL DEFAULT 'THUMBNAIL',
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "billingUnit" "AdBillingUnit" NOT NULL DEFAULT 'DAY',
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
    "advertiserId" TEXT,
    "adContentId" TEXT,
    "adProductId" TEXT NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "maxImpressions" INTEGER,
    "targetCountryId" TEXT,
    "targetCityId" TEXT,
    "estimatedAmount" DECIMAL(10,2),
    "proposedAmount" DECIMAL(10,2),
    "finalAmount" DECIMAL(10,2),
    "billingStatus" "AdBillingStatus" NOT NULL DEFAULT 'DRAFT',
    "pricingSnapshot" JSONB,
    "pricingConfirmationSnapshot" JSONB,
    "priceAdjustmentReason" TEXT,
    "priceConfirmedByUserId" TEXT,
    "priceConfirmedAt" TIMESTAMP(3),
    "landingUrl" TEXT,
    "notes" TEXT,
    "reviewNotes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sourcedByUserId" TEXT,
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
    "adContentId" TEXT NOT NULL,
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
    "adContentId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "AdGeoPricing" (
    "id" TEXT NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "multiplier" DECIMAL(8,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdGeoPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Country_slug_key" ON "Country"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "PostTagOption_categoryType_isActive_sortOrder_idx" ON "PostTagOption"("categoryType", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PostTagOption_categoryType_label_key" ON "PostTagOption"("categoryType", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PostTagOption_categoryType_slug_key" ON "PostTagOption"("categoryType", "slug");

-- CreateIndex
CREATE INDEX "PostPermission_subjectType_userId_idx" ON "PostPermission"("subjectType", "userId");

-- CreateIndex
CREATE INDEX "PostPermission_subjectType_role_idx" ON "PostPermission"("subjectType", "role");

-- CreateIndex
CREATE INDEX "PostPermission_countryId_cityId_categoryId_idx" ON "PostPermission"("countryId", "cityId", "categoryId");

-- CreateIndex
CREATE INDEX "Post_cityId_categoryId_status_createdAt_idx" ON "Post"("cityId", "categoryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_status_isPinned_pinnedAt_createdAt_id_idx" ON "Post"("status", "isPinned" DESC, "pinnedAt" DESC, "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Post_status_countryId_createdAt_id_idx" ON "Post"("status", "countryId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_status_cityId_createdAt_id_idx" ON "Post"("status", "cityId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_status_categoryId_createdAt_id_idx" ON "Post"("status", "categoryId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_authorId_status_createdAt_idx" ON "Post"("authorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_createdByUserId_createdAt_idx" ON "Post"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_bestCommentId_idx" ON "Post"("bestCommentId");

-- CreateIndex
CREATE INDEX "Post_status_communityScore_createdAt_idx" ON "Post"("status", "communityScore" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_status_viewCount_createdAt_idx" ON "Post"("status", "viewCount" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PostTag_postTagOptionId_createdAt_idx" ON "PostTag"("postTagOptionId", "createdAt");

-- CreateIndex
CREATE INDEX "PostTag_postId_createdAt_idx" ON "PostTag"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostTag_postTagOptionId_postId_idx" ON "PostTag"("postTagOptionId", "postId");

-- CreateIndex
CREATE INDEX "SavedPost_userId_createdAt_idx" ON "SavedPost"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedPost_userId_createdAt_id_idx" ON "SavedPost"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SavedPost_postId_createdAt_idx" ON "SavedPost"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "SavedPost"("userId", "postId");

-- CreateIndex
CREATE INDEX "PostView_postId_viewedAt_idx" ON "PostView"("postId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PostView_postId_userId_viewedAt_idx" ON "PostView"("postId", "userId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PostView_postId_fingerprint_viewedAt_idx" ON "PostView"("postId", "fingerprint", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PostView_viewedAt_postId_idx" ON "PostView"("viewedAt", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_userId_windowKey_key" ON "PostView"("postId", "userId", "windowKey");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_fingerprint_windowKey_key" ON "PostView"("postId", "fingerprint", "windowKey");

-- CreateIndex
CREATE INDEX "PageViewDailyStat_date_idx" ON "PageViewDailyStat"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PageViewDailyStat_date_path_key" ON "PageViewDailyStat"("date", "path");

-- CreateIndex
CREATE UNIQUE INDEX "ReportOption_label_key" ON "ReportOption"("label");

-- CreateIndex
CREATE INDEX "PostReport_postId_createdAt_idx" ON "PostReport"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostReport_reporterId_createdAt_idx" ON "PostReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "PostReport_reviewStatus_createdAt_idx" ON "PostReport"("reviewStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostReport_postId_reporterId_key" ON "PostReport"("postId", "reporterId");

-- CreateIndex
CREATE INDEX "CommentReport_commentId_createdAt_idx" ON "CommentReport"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "CommentReport_reporterId_createdAt_idx" ON "CommentReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "CommentReport_reviewStatus_createdAt_idx" ON "CommentReport"("reviewStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReport_commentId_reporterId_key" ON "CommentReport"("commentId", "reporterId");

-- CreateIndex
CREATE INDEX "Comment_postId_status_createdAt_idx" ON "Comment"("postId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_status_id_idx" ON "Comment"("postId", "status", "id");

-- CreateIndex
CREATE INDEX "Comment_createdByUserId_createdAt_idx" ON "Comment"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_createdAt_postId_status_idx" ON "Comment"("createdAt", "postId", "status");

-- CreateIndex
CREATE INDEX "PostLike_postId_createdAt_idx" ON "PostLike"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostLike_userId_createdAt_idx" ON "PostLike"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PostLike_createdAt_postId_idx" ON "PostLike"("createdAt", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_createdAt_idx" ON "CommentLike"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "CommentLike_userId_createdAt_idx" ON "CommentLike"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_createdAt_idx" ON "ModerationAction"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "UserRestriction_userId_status_idx" ON "UserRestriction"("userId", "status");

-- CreateIndex
CREATE INDEX "SearchAlert_userId_createdAt_idx" ON "SearchAlert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchAlert_createdAt_query_idx" ON "SearchAlert"("createdAt", "query");

-- CreateIndex
CREATE INDEX "SearchAlert_countryIdSnapshot_createdAt_idx" ON "SearchAlert"("countryIdSnapshot", "createdAt");

-- CreateIndex
CREATE INDEX "SearchAlert_cityIdSnapshot_createdAt_idx" ON "SearchAlert"("cityIdSnapshot", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchAlert_userId_query_key" ON "SearchAlert"("userId", "query");

-- CreateIndex
CREATE UNIQUE INDEX "KakaoMessageDelivery_dedupeKey_key" ON "KakaoMessageDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "KakaoMessageDelivery_status_createdAt_idx" ON "KakaoMessageDelivery"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "KakaoMessageDelivery_recipientUserId_createdAt_idx" ON "KakaoMessageDelivery"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "KakaoMessageDelivery_deliveryType_createdAt_idx" ON "KakaoMessageDelivery"("deliveryType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CommunityScoreEvent_targetType_targetId_createdAt_idx" ON "CommunityScoreEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityScoreEvent_postId_createdAt_idx" ON "CommunityScoreEvent"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityScoreEvent_commentId_createdAt_idx" ON "CommunityScoreEvent"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NeighbourWarmthLog_userId_createdAt_idx" ON "NeighbourWarmthLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LocationChangeLog_userId_createdAt_idx" ON "LocationChangeLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LocationChangeLog_actorId_createdAt_idx" ON "LocationChangeLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AdProduct_code_key" ON "AdProduct"("code");

-- CreateIndex
CREATE INDEX "AdCampaign_status_startAt_endAt_idx" ON "AdCampaign"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "AdCampaign_status_startAt_endAt_targetCountryId_targetCityI_idx" ON "AdCampaign"("status", "startAt", "endAt", "targetCountryId", "targetCityId");

-- CreateIndex
CREATE INDEX "AdCampaign_adProductId_status_idx" ON "AdCampaign"("adProductId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_advertiserId_status_idx" ON "AdCampaign"("advertiserId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_adContentId_status_idx" ON "AdCampaign"("adContentId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_targetCountryId_status_idx" ON "AdCampaign"("targetCountryId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_targetCityId_status_idx" ON "AdCampaign"("targetCityId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_sourcedByUserId_status_idx" ON "AdCampaign"("sourcedByUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlacementRule_placementType_key" ON "AdPlacementRule"("placementType");

-- CreateIndex
CREATE INDEX "AdImpression_campaignId_viewedAt_idx" ON "AdImpression"("campaignId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdImpression_adContentId_viewedAt_idx" ON "AdImpression"("adContentId", "viewedAt");

-- CreateIndex
CREATE INDEX "AdImpression_viewedAt_idx" ON "AdImpression"("viewedAt");

-- CreateIndex
CREATE INDEX "AdClick_campaignId_clickedAt_idx" ON "AdClick"("campaignId", "clickedAt");

-- CreateIndex
CREATE INDEX "AdClick_adContentId_clickedAt_idx" ON "AdClick"("adContentId", "clickedAt");

-- CreateIndex
CREATE INDEX "AdClick_clickedAt_idx" ON "AdClick"("clickedAt");

-- CreateIndex
CREATE INDEX "AdDailyStat_campaignId_date_idx" ON "AdDailyStat"("campaignId", "date" DESC);

-- CreateIndex
CREATE INDEX "AdDailyStat_date_idx" ON "AdDailyStat"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyStat_campaignId_date_key" ON "AdDailyStat"("campaignId", "date");

-- CreateIndex
CREATE INDEX "AdGeoPricing_cityId_isActive_effectiveFrom_effectiveTo_idx" ON "AdGeoPricing"("cityId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "AdGeoPricing_countryId_isActive_effectiveFrom_effectiveTo_idx" ON "AdGeoPricing"("countryId", "isActive", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "StaffAssignment_userId_isActive_idx" ON "StaffAssignment"("userId", "isActive");

-- CreateIndex
CREATE INDEX "StaffAssignment_role_isActive_idx" ON "StaffAssignment"("role", "isActive");

-- CreateIndex
CREATE INDEX "StaffAssignment_countryId_cityId_idx" ON "StaffAssignment"("countryId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_slug_key" ON "Advertiser"("slug");

-- CreateIndex
CREATE INDEX "Advertiser_countryId_cityId_idx" ON "Advertiser"("countryId", "cityId");

-- CreateIndex
CREATE INDEX "AdvertiserMember_userId_isActive_idx" ON "AdvertiserMember"("userId", "isActive");

-- CreateIndex
CREATE INDEX "AdvertiserMember_advertiserId_role_isActive_idx" ON "AdvertiserMember"("advertiserId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserMember_advertiserId_userId_key" ON "AdvertiserMember"("advertiserId", "userId");

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
CREATE INDEX "AdAuditLog_campaignId_createdAt_idx" ON "AdAuditLog"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_proposalId_createdAt_idx" ON "AdAuditLog"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_adContentId_createdAt_idx" ON "AdAuditLog"("adContentId", "createdAt");

-- CreateIndex
CREATE INDEX "AdAuditLog_advertiserId_createdAt_idx" ON "AdAuditLog"("advertiserId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerIncentive_partnerUserId_status_idx" ON "PartnerIncentive"("partnerUserId", "status");

-- CreateIndex
CREATE INDEX "PartnerIncentive_partnerUserId_periodStart_periodEnd_idx" ON "PartnerIncentive"("partnerUserId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PartnerIncentive_status_createdAt_idx" ON "PartnerIncentive"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPermission" ADD CONSTRAINT "PostPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPermission" ADD CONSTRAINT "PostPermission_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPermission" ADD CONSTRAINT "PostPermission_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPermission" ADD CONSTRAINT "PostPermission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_bestCommentId_fkey" FOREIGN KEY ("bestCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postTagOptionId_fkey" FOREIGN KEY ("postTagOptionId") REFERENCES "PostTagOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ReportOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ReportOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostImage" ADD CONSTRAINT "PostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlert" ADD CONSTRAINT "SearchAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlert" ADD CONSTRAINT "SearchAlert_countryIdSnapshot_fkey" FOREIGN KEY ("countryIdSnapshot") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAlert" ADD CONSTRAINT "SearchAlert_cityIdSnapshot_fkey" FOREIGN KEY ("cityIdSnapshot") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KakaoMessageDelivery" ADD CONSTRAINT "KakaoMessageDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityScoreEvent" ADD CONSTRAINT "CommunityScoreEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityScoreEvent" ADD CONSTRAINT "CommunityScoreEvent_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeighbourWarmthLog" ADD CONSTRAINT "NeighbourWarmthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationChangeLog" ADD CONSTRAINT "LocationChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationChangeLog" ADD CONSTRAINT "LocationChangeLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adContentId_fkey" FOREIGN KEY ("adContentId") REFERENCES "AdContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adProductId_fkey" FOREIGN KEY ("adProductId") REFERENCES "AdProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_targetCountryId_fkey" FOREIGN KEY ("targetCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_targetCityId_fkey" FOREIGN KEY ("targetCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_priceConfirmedByUserId_fkey" FOREIGN KEY ("priceConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_sourcedByUserId_fkey" FOREIGN KEY ("sourcedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImpression" ADD CONSTRAINT "AdImpression_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdClick" ADD CONSTRAINT "AdClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGeoPricing" ADD CONSTRAINT "AdGeoPricing_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGeoPricing" ADD CONSTRAINT "AdGeoPricing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser" ADD CONSTRAINT "Advertiser_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser" ADD CONSTRAINT "Advertiser_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerIncentive" ADD CONSTRAINT "PartnerIncentive_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

