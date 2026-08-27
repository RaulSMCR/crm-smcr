-- Reconciliación parcial del drift entre la base y el schema.
--
-- Solo se crean los dos índices de rendimiento que faltaban. Los otros tres
-- puntos de divergencia se dejan a propósito:
--
--   * PaymentTransaction_onvoEventId_key EXISTE, pero como índice único PARCIAL
--     (WHERE "onvoEventId" IS NOT NULL). Protege exactamente igual que el total
--     que declara el schema —en Postgres los NULL nunca colisionan entre sí—, y
--     reconciliarlo obligaría a DROP + CREATE sobre la garantía de idempotencia
--     del webhook de pagos. No se toca por cosmética justo antes de habilitar
--     cobros reales.
--
--   * OutreachLog.updatedAt y TaskLog.updatedAt conservan un DEFAULT que el
--     schema no declara. Prisma llena @updatedAt desde la aplicación, así que el
--     default sobra pero no estorba; quitarlo solo rompería inserciones por SQL
--     directo. Beneficio cosmético, riesgo real: se deja.
--
-- IF NOT EXISTS en ambos: la migración tiene que poder repetirse sin fallar.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OutreachLog_seguimiento_idx" ON "OutreachLog"("seguimiento");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceAssignment_onvoPaymentLinkId_idx" ON "ServiceAssignment"("onvoPaymentLinkId");
