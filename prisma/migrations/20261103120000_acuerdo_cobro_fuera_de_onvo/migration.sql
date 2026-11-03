-- Acuerdos de atención para todos los profesionales (decisión de Raúl,
-- 2026-11-03).
--
-- Hasta ahora solo Raúl tenía acuerdos y ninguna sesión de acuerdo generaba
-- enlace de ONVO: se cobraban por SINPE con pagos manuales. Ahora los demás
-- profesionales también los crean y sus sesiones se cobran por ONVO al
-- completarlas. Esta columna dice qué acuerdos siguen cobrándose fuera de ONVO.
--
-- Aditiva: una columna con valor por defecto. Los acuerdos que ya existen
-- (todos de Raúl) se marcan como «fuera de ONVO» para que sigan exactamente
-- igual que antes; los nuevos nacen en false.
--
-- Aplicar con `pnpm run migrate` (prisma migrate deploy) ANTES de desplegar:
-- sin la columna, crear un acuerdo falla.

ALTER TABLE "AcuerdoDeAtencion" ADD COLUMN IF NOT EXISTS "cobroFueraDeOnvo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AcuerdoDeAtencion" SET "cobroFueraDeOnvo" = true WHERE "createdAt" < '2026-11-03T12:00:00Z';
