-- Segmentación de comunicados por profesional, servicio y ventana temporal.
-- Migración aditiva sobre una tabla que todavía no tiene filas.

-- AlterTable
ALTER TABLE "AdminMessage" ADD COLUMN "targetProfessionals" TEXT;
ALTER TABLE "AdminMessage" ADD COLUMN "targetServices" TEXT;
ALTER TABLE "AdminMessage" ADD COLUMN "targetWindow" TEXT;
ALTER TABLE "AdminMessage" ADD COLUMN "targetWindowDays" INTEGER;
ALTER TABLE "AdminMessage" ADD COLUMN "targetIncludeCancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminMessage" ADD COLUMN "targetNegate" BOOLEAN NOT NULL DEFAULT false;
