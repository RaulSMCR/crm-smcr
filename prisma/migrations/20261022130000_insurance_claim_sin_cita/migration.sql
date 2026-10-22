-- Piloto PALIG por comprobante: el trámite de seguro deja de exigir una cita.
--
-- El eje es el pago (comprobante SINPE → factura → formulario con la fecha del
-- pago). Si el pago se asocia a una sesión, `appointmentId` sigue llenándose y
-- la sesión queda pagada; si no, queda vacío.
--
-- Aditiva e idempotente: solo quita el NOT NULL (repetirla no hace nada). No
-- toca datos. La clave foránea se conserva como está —ON DELETE RESTRICT—, así
-- que una cita con trámite de seguro sigue sin poder borrarse.
--
-- Aplicar con `pnpm run migrate` (prisma migrate deploy) ANTES de desplegar.

ALTER TABLE "InsuranceClaim" ALTER COLUMN "appointmentId" DROP NOT NULL;
