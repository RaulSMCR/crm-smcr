-- Revisión por slide: nota de edición y marca de "listo".
ALTER TABLE "CarouselAsset" ADD COLUMN "ready" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CarouselAsset" ADD COLUMN "note" TEXT;
