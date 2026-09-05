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
CREATE TYPE "KakaoMessageDeliveryType" AS ENUM ('SEARCH_ALERT', 'COMMENT_NOTIFICATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POST_LIKE', 'COMMENT_CREATED', 'COMMENT_LIKE', 'BEST_COMMENT_SELECTED', 'POST_HELD', 'COMMENT_HELD');

-- CreateEnum
CREATE TYPE "KakaoMessageDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportReviewStatus" AS ENUM ('PENDING', 'VALID', 'FALSE_REPORT');

-- CreateEnum
CREATE TYPE "LocationChangeType" AS ENUM ('CITY_CHANGED', 'COUNTRY_CHANGED_CITY_RESET', 'ADMIN_OVERRIDE');

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
    "role" "UserRole" NOT NULL DEFAULT 'USER',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KakaoMessageDelivery" (
    "id" TEXT NOT NULL,
    "deliveryType" "KakaoMessageDeliveryType" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
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
CREATE INDEX "PostLike_postId_createdAt_idx" ON "PostLike"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostLike_userId_createdAt_idx" ON "PostLike"("userId", "createdAt");

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
CREATE UNIQUE INDEX "SearchAlert_userId_query_key" ON "SearchAlert"("userId", "query");

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
