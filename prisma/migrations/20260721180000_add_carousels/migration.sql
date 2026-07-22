-- CreateEnum
CREATE TYPE "CarouselStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Carousel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CarouselStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB NOT NULL,
    "articleUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carousel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarouselAsset" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1080,

    CONSTRAINT "CarouselAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carousel_slug_key" ON "Carousel"("slug");

-- CreateIndex
CREATE INDEX "Carousel_status_idx" ON "Carousel"("status");

-- CreateIndex
CREATE INDEX "Carousel_createdBy_idx" ON "Carousel"("createdBy");

-- CreateIndex
CREATE INDEX "CarouselAsset_carouselId_idx" ON "CarouselAsset"("carouselId");

-- CreateIndex
CREATE UNIQUE INDEX "CarouselAsset_carouselId_index_key" ON "CarouselAsset"("carouselId", "index");

-- AddForeignKey
ALTER TABLE "CarouselAsset" ADD CONSTRAINT "CarouselAsset_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "Carousel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
