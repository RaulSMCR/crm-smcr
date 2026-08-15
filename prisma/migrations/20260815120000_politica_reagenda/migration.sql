-- Política de reagendado: se puede mover una cita avisando con 24 horas. Pasado
-- ese margen se cobra el 50% y el paciente queda sin agendar por su cuenta hasta
-- que un administrador lo contacte y le devuelva el acceso.

ALTER TYPE "PaymentTransactionType" ADD VALUE IF NOT EXISTS 'PENALTY_50';

-- El bloqueo vive en el paciente, no en la cita: arrastra de una cita a la
-- siguiente, que es justamente su propósito.
ALTER TABLE "User" ADD COLUMN "schedulingBlockedAt"     TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "schedulingBlockedReason" VARCHAR(32);
ALTER TABLE "User" ADD COLUMN "schedulingRestoredAt"    TIMESTAMP(3);

-- Idempotencia: marcar dos veces el mismo no-show no debe cobrar dos multas.
ALTER TABLE "Appointment" ADD COLUMN "penaltyAppliedAt" TIMESTAMP(3);
