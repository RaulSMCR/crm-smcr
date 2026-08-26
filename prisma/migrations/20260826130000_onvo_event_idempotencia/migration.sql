-- Idempotencia del webhook de ONVO.
--
-- `PaymentTransaction.onvoEventId` está declarado @unique en el schema, pero el
-- índice nunca llegó a la base. Sin él, un reintento del webhook —ONVO reintenta
-- cuando no recibe 2xx a tiempo— registra el mismo pago dos veces: el paciente
-- aparece pagando doble y la liquidación le paga doble al profesional.
--
-- Se crea antes de habilitar cobros reales. Migración aditiva: solo un índice.
-- Los NULL no colisionan entre sí en Postgres, así que las transacciones que
-- todavía no tienen evento asociado conviven sin problema.

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_onvoEventId_key"
  ON "PaymentTransaction"("onvoEventId");
