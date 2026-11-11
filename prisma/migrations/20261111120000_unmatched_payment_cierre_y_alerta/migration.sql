-- Conciliación ONVO: cómo se cerró cada pendiente y cuándo se avisó al admin
-- (decisión de Raúl, 2026-11-11).
--
-- ONVO avisa cada cobro dos veces. Si payment-intent.succeeded (sin enlace)
-- llega antes que checkout-session.succeeded, el primero queda pendiente y ya
-- no se alerta en el acto: QStash verifica a los ~5 minutos y solo avisa si el
-- cobro sigue sin acreditar.
--
--   resolution  quién o qué cerró el pendiente.
--   alertedAt   cuándo se avisó; es el candado que evita alertas repetidas.
--
-- Aditiva e idempotente: dos columnas que admiten NULL, sin tocar filas.
--
-- Aplicar ANTES de desplegar el código: sin las columnas falla toda consulta
-- a UnmatchedPayment, también la del webhook de ONVO.

ALTER TABLE "UnmatchedPayment" ADD COLUMN IF NOT EXISTS "resolution" TEXT;
ALTER TABLE "UnmatchedPayment" ADD COLUMN IF NOT EXISTS "alertedAt" TIMESTAMP(3);
