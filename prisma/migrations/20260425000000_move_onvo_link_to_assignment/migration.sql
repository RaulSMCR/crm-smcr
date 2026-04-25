-- Mueve onvoPaymentLinkId de ProfessionalProfile → ServiceAssignment
-- para soportar tarifas distintas por servicio.

-- 1. Agregar columna a ServiceAssignment
ALTER TABLE "ServiceAssignment"
  ADD COLUMN IF NOT EXISTS "onvoPaymentLinkId" TEXT;

-- 2. Migrar datos existentes: copiar el link del profesional a todas sus asignaciones
UPDATE "ServiceAssignment" sa
SET "onvoPaymentLinkId" = pp."onvoPaymentLinkId"
FROM "ProfessionalProfile" pp
WHERE sa."professionalId" = pp."id"
  AND pp."onvoPaymentLinkId" IS NOT NULL;

-- 3. Índice de búsqueda
CREATE INDEX IF NOT EXISTS "ServiceAssignment_onvoPaymentLinkId_idx"
  ON "ServiceAssignment"("onvoPaymentLinkId")
  WHERE "onvoPaymentLinkId" IS NOT NULL;

-- 4. Eliminar columna de ProfessionalProfile
ALTER TABLE "ProfessionalProfile"
  DROP COLUMN IF EXISTS "onvoPaymentLinkId";
