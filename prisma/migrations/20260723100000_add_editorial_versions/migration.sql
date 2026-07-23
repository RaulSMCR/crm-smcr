-- Versiones inmutables y eventos de revisión para el flujo editorial manual.

ALTER TABLE "Carousel" ADD COLUMN "activeVersionId" TEXT;

CREATE TABLE "CarouselVersion" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "specHash" TEXT NOT NULL,
    "parentVersionId" TEXT,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarouselVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarouselVersionAsset" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'rendered-slide',
    "index" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "sha256" TEXT,
    "note" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarouselVersionAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarouselApprovalEvent" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarouselApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarouselVersion_carouselId_number_key" ON "CarouselVersion"("carouselId", "number");
CREATE INDEX "CarouselVersion_carouselId_createdAt_idx" ON "CarouselVersion"("carouselId", "createdAt");
CREATE INDEX "CarouselVersion_parentVersionId_idx" ON "CarouselVersion"("parentVersionId");
CREATE UNIQUE INDEX "CarouselVersionAsset_versionId_slideId_role_key" ON "CarouselVersionAsset"("versionId", "slideId", "role");
CREATE INDEX "CarouselVersionAsset_versionId_idx" ON "CarouselVersionAsset"("versionId");
CREATE INDEX "CarouselVersionAsset_slideId_idx" ON "CarouselVersionAsset"("slideId");
CREATE INDEX "CarouselApprovalEvent_carouselId_slideId_createdAt_idx" ON "CarouselApprovalEvent"("carouselId", "slideId", "createdAt");
CREATE INDEX "CarouselApprovalEvent_versionId_idx" ON "CarouselApprovalEvent"("versionId");
CREATE INDEX "Carousel_activeVersionId_idx" ON "Carousel"("activeVersionId");

ALTER TABLE "CarouselVersion" ADD CONSTRAINT "CarouselVersion_carouselId_fkey"
  FOREIGN KEY ("carouselId") REFERENCES "Carousel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarouselVersion" ADD CONSTRAINT "CarouselVersion_parentVersionId_fkey"
  FOREIGN KEY ("parentVersionId") REFERENCES "CarouselVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CarouselVersionAsset" ADD CONSTRAINT "CarouselVersionAsset_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "CarouselVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarouselApprovalEvent" ADD CONSTRAINT "CarouselApprovalEvent_carouselId_fkey"
  FOREIGN KEY ("carouselId") REFERENCES "Carousel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarouselApprovalEvent" ADD CONSTRAINT "CarouselApprovalEvent_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "CarouselVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Carousel" ADD CONSTRAINT "Carousel_activeVersionId_fkey"
  FOREIGN KEY ("activeVersionId") REFERENCES "CarouselVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
