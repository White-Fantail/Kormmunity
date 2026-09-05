-- AlterTable
ALTER TABLE "Post"
ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

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

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_userId_windowKey_key" ON "PostView"("postId", "userId", "windowKey");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_fingerprint_windowKey_key" ON "PostView"("postId", "fingerprint", "windowKey");

-- CreateIndex
CREATE INDEX "PostView_postId_viewedAt_idx" ON "PostView"("postId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PostView_postId_userId_viewedAt_idx" ON "PostView"("postId", "userId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "PostView_postId_fingerprint_viewedAt_idx" ON "PostView"("postId", "fingerprint", "viewedAt" DESC);

-- AddForeignKey
ALTER TABLE "PostView"
ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView"
ADD CONSTRAINT "PostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
