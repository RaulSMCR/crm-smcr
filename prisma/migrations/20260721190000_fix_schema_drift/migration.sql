-- Reconcilia el drift preexistente entre schema.prisma y la base (ajeno a carruseles).
-- Idempotente a propósito: el `migrate diff` reportó como faltantes dos índices que en
-- realidad ya existen en la base (quirk de introspección), así que se guardan con
-- IF NOT EXISTS y quedan en no-op. Los cambios reales son: dropear Service_taxId_idx,
-- agregar Settlement.userId y su FK a User.

-- DropIndex (existe en la base, el schema no lo declara)
DROP INDEX IF EXISTS "Service_taxId_idx";

-- AlterTable (la columna no existía)
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateIndex (ya existe y es válido: no-op)
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_onvoEventId_key" ON "PaymentTransaction"("onvoEventId");

-- CreateIndex (ya existe: no-op)
CREATE INDEX IF NOT EXISTS "ServiceAssignment_onvoPaymentLinkId_idx" ON "ServiceAssignment"("onvoPaymentLinkId");

-- AddForeignKey (no existía; guardado por si se re-ejecuta)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Settlement_userId_fkey') THEN
    ALTER TABLE "Settlement"
      ADD CONSTRAINT "Settlement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
