-- Migration: 20260424000000_replace_placetopay_with_onvo
-- Reemplaza la integración de PlacetoPay (Evertec BCR) por ONVO Costa Rica.
-- Los enlaces de pago de ONVO son productos preconfigurados con monto fijo
-- que el administrador asocia a cada profesional.

-- ─── 1. Agregar nuevo valor al enum PaymentTransactionStatus ────────────────
ALTER TYPE "PaymentTransactionStatus" ADD VALUE IF NOT EXISTS 'LINK_SENT';

-- ─── 2. Agregar columnas ONVO a PaymentTransaction ──────────────────────────
ALTER TABLE "PaymentTransaction"
  ADD COLUMN IF NOT EXISTS "onvoPaymentLinkId" TEXT,
  ADD COLUMN IF NOT EXISTS "onvoEventId"       TEXT,
  ADD COLUMN IF NOT EXISTS "statusMessage"     TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt"            TIMESTAMP(3);

-- ─── 3. Unique constraint en onvoEventId (idempotencia de webhooks) ─────────
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_onvoEventId_key"
  ON "PaymentTransaction"("onvoEventId")
  WHERE "onvoEventId" IS NOT NULL;

-- ─── 4. Índice de búsqueda por onvoPaymentLinkId ────────────────────────────
CREATE INDEX IF NOT EXISTS "PaymentTransaction_onvoPaymentLinkId_idx"
  ON "PaymentTransaction"("onvoPaymentLinkId");

-- ─── 5. Eliminar columnas de PlacetoPay ─────────────────────────────────────
ALTER TABLE "PaymentTransaction"
  DROP COLUMN IF EXISTS "p2pRequestId",
  DROP COLUMN IF EXISTS "p2pReference",
  DROP COLUMN IF EXISTS "p2pProcessUrl",
  DROP COLUMN IF EXISTS "p2pStatusCode",
  DROP COLUMN IF EXISTS "p2pStatusMessage",
  DROP COLUMN IF EXISTS "p2pPaymentDate";

-- ─── 6. Renombrar paymentLinkBase → onvoPaymentLinkId en ProfessionalProfile ─
ALTER TABLE "ProfessionalProfile"
  RENAME COLUMN "paymentLinkBase" TO "onvoPaymentLinkId";

-- ─── 7. Migrar transacciones PROCESSING → LINK_SENT ─────────────────────────
-- Las transacciones que estaban en PROCESSING en PlacetoPay se marcan como
-- LINK_SENT para que el estado sea coherente con el nuevo flujo de ONVO.
UPDATE "PaymentTransaction"
  SET "status" = 'LINK_SENT'
  WHERE "status" = 'PROCESSING';
