-- CreateIndex: 인기 정렬용 인덱스 (status + communityScore DESC + createdAt DESC)
CREATE INDEX "Post_status_communityScore_createdAt_idx" ON "Post"("status", "communityScore" DESC, "createdAt" DESC);

-- CreateIndex: 인기 정렬용 인덱스 (status + viewCount DESC + createdAt DESC)
CREATE INDEX "Post_status_viewCount_createdAt_idx" ON "Post"("status", "viewCount" DESC, "createdAt" DESC);

-- CreateIndex: 최근 n시간 집계 최적화 - PostView(viewedAt, postId)
CREATE INDEX "PostView_viewedAt_postId_idx" ON "PostView"("viewedAt", "postId");

-- CreateIndex: 최근 n시간 집계 최적화 - PostLike(createdAt, postId)
CREATE INDEX "PostLike_createdAt_postId_idx" ON "PostLike"("createdAt", "postId");

-- CreateIndex: 최근 n시간 집계 최적화 - Comment(createdAt, postId, status)
CREATE INDEX "Comment_createdAt_postId_status_idx" ON "Comment"("createdAt", "postId", "status");
