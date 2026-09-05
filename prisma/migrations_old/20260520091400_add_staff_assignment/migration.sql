-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MODERATOR', 'COORDINATOR', 'ADMIN');

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

-- CreateIndex
CREATE INDEX "StaffAssignment_userId_isActive_idx" ON "StaffAssignment"("userId", "isActive");

-- CreateIndex
CREATE INDEX "StaffAssignment_role_isActive_idx" ON "StaffAssignment"("role", "isActive");

-- CreateIndex
CREATE INDEX "StaffAssignment_countryId_cityId_idx" ON "StaffAssignment"("countryId", "cityId");

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
