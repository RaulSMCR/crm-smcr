-- Cola persistente de envíos de pago y factura (DeliveryJob).
--
-- Aditiva e idempotente: enums con EXCEPTION, tabla e índices con IF NOT EXISTS
-- y claves foráneas con chequeo en pg_constraint, para poder reintentarla si una
-- corrida queda a medias. Aplicar con `prisma migrate deploy`; nunca con
-- migrate dev ni migrate reset.
DO $$ BEGIN
  CREATE TYPE "DeliveryJobKind" AS ENUM ('PAYMENT_CONFIRMATION', 'FE_SUBMISSION', 'FE_RECEIPT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DeliveryJob" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "kind" "DeliveryJobKind" NOT NULL,
  "status" "DeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
  "paymentTransactionId" TEXT,
  "invoiceId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "firstSendAt" TIMESTAMP(3),
  "payloadHash" TEXT,
  "providerId" TEXT,
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryJob_dedupeKey_key" ON "DeliveryJob"("dedupeKey");
CREATE INDEX IF NOT EXISTS "DeliveryJob_status_nextAttemptAt_idx" ON "DeliveryJob"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "DeliveryJob_status_lockedUntil_idx" ON "DeliveryJob"("status", "lockedUntil");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryJob_invoiceId_fkey') THEN
    ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryJob_paymentTransactionId_fkey') THEN
    ALTER TABLE "DeliveryJob" ADD CONSTRAINT "DeliveryJob_paymentTransactionId_fkey"
      FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Acceso exclusivamente a través del servidor. No conceder permisos a anon/authenticated.
ALTER TABLE "DeliveryJob" ENABLE ROW LEVEL SECURITY;
