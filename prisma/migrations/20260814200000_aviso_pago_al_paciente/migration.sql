-- Aviso al paciente de que su pago se acreditó.
--
-- El paciente casi nunca esta mirando la app cuando ONVO confirma el cobro: paga
-- desde el correo y el webhook llega despues. Con esta marca el aviso lo espera
-- hasta que vuelva a entrar, y se muestra una sola vez.
ALTER TABLE "PaymentTransaction" ADD COLUMN "patientNotifiedAt" TIMESTAMP(3);
