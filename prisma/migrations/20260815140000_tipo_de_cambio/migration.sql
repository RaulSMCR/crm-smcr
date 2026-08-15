-- Tipo de cambio del dólar, uno por día.
--
-- ONVO cobra su fijo por transacción en dólares y su liquidación llega con SU
-- tipo de cambio del día. Guardar el que se usó, y de dónde salió, es lo que
-- permite explicar la diferencia en vez de asumirla.
CREATE TABLE "ExchangeRate" (
  "id"        TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "sell"      DECIMAL(12,4) NOT NULL,
  "buy"       DECIMAL(12,4),
  "source"    VARCHAR(16) NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExchangeRate_date_key" ON "ExchangeRate"("date");
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");
