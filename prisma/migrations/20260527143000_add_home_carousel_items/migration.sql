-- CreateTable
CREATE TABLE "HomeCarouselItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "postId" TEXT,
    "professionalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCarouselItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCarouselItem_kind_isActive_displayOrder_idx" ON "HomeCarouselItem"("kind", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "HomeCarouselItem_postId_idx" ON "HomeCarouselItem"("postId");

-- CreateIndex
CREATE INDEX "HomeCarouselItem_professionalId_idx" ON "HomeCarouselItem"("professionalId");

-- AddForeignKey
ALTER TABLE "HomeCarouselItem" ADD CONSTRAINT "HomeCarouselItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeCarouselItem" ADD CONSTRAINT "HomeCarouselItem_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
