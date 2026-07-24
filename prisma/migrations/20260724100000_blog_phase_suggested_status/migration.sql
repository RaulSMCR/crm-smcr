-- Fase (nivel sobre la serie) y estado sugerido por el profesional.
-- Migracion ADITIVA: nueva tabla Phase, columna Series.phaseId y columna
-- Post.suggestedStatus. No altera ni borra datos existentes.

-- CreateEnum
CREATE TYPE "SuggestedStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "suggestedStatus" "SuggestedStatus";

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "phaseId" TEXT;

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Phase_name_key" ON "Phase"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Phase_slug_key" ON "Phase"("slug");

-- CreateIndex
CREATE INDEX "Phase_isActive_order_idx" ON "Phase"("isActive", "order");

-- CreateIndex
CREATE INDEX "Series_phaseId_idx" ON "Series"("phaseId");

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

