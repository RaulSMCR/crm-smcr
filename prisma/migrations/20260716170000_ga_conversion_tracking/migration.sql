-- Atribución publicitaria + idempotencia de conversión GA4/Ads.
-- Appointment: identificadores capturados al agendar (el pago confirma días después).
-- PaymentTransaction: guarda si la conversión ya se envió (claim atómico).

ALTER TABLE "Appointment"
  ADD COLUMN "gaClientId" TEXT,
  ADD COLUMN "gaGclid" TEXT;

ALTER TABLE "PaymentTransaction"
  ADD COLUMN "conversionSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "conversionSentAt" TIMESTAMP(3);
