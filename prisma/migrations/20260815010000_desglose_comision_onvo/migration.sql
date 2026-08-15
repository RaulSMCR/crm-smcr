-- ONVO cobra el fijo por transacción en dólares (US$0.35 con tarjeta), no en
-- colones. processingFee guarda la suma ya convertida, que es una estimación:
-- la liquidación de ONVO llega con SU tipo de cambio del día. Guardar aparte el
-- monto en dólares y el tipo de cambio aplicado es lo que permite explicar la
-- diferencia en vez de tener que asumirla.
ALTER TABLE "PaymentTransaction" ADD COLUMN "processingFeeUsd" DECIMAL(10,2);
ALTER TABLE "PaymentTransaction" ADD COLUMN "usdCrcRate" DECIMAL(12,4);
