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

-- CreateIndex
CREATE UNIQUE INDEX "PageViewDailyStat_date_path_key" ON "PageViewDailyStat"("date", "path");

-- CreateIndex
CREATE INDEX "PageViewDailyStat_date_idx" ON "PageViewDailyStat"("date" DESC);
