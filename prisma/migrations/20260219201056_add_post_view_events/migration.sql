/*
  Warnings:

  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- CreateTable
CREATE TABLE "PostViewEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "landingUrl" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "timeOnPageSeconds" INTEGER,
    "scrollDepth" INTEGER,

    CONSTRAINT "PostViewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostViewEvent_postId_createdAt_idx" ON "PostViewEvent"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostViewEvent_createdAt_idx" ON "PostViewEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PostViewEvent_anonId_idx" ON "PostViewEvent"("anonId");

-- CreateIndex
CREATE INDEX "PostViewEvent_utmSource_utmMedium_utmCampaign_idx" ON "PostViewEvent"("utmSource", "utmMedium", "utmCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "PostViewEvent_sessionId_postId_key" ON "PostViewEvent"("sessionId", "postId");

-- AddForeignKey
ALTER TABLE "PostViewEvent" ADD CONSTRAINT "PostViewEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostViewEvent" ADD CONSTRAINT "PostViewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
