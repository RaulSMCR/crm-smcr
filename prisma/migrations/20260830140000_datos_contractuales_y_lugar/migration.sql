-- Domicilio e IBAN del profesional, y las señas del lugar en la cita.
--
-- Los dos primeros son los que faltaban para poder emitir el contrato completo:
-- el Anexo A individualiza al Profesional con su domicilio, y la cláusula 4.3
-- paga los honorarios "mediante transferencia electrónica a la cuenta indicada
-- en el Anexo A". Hasta ahora ninguno de los dos existía en la base y el
-- contrato salía con dos líneas en blanco.
--
-- `domicilio` no es la dirección del consultorio: esa vive en PracticeLocation y
-- puede haber varias. Este es el domicilio de la persona, y solo se pide porque
-- el contrato lo exige.
--
-- `Appointment.locationNotes` completa la copia congelada del lugar. La cita ya
-- guardaba nombre y dirección; faltaba el "cómo llegar" (piso, timbre, señas),
-- que es justo lo que hace útil una dirección y que el paciente recibe al
-- agendar y en cada recordatorio.
--
-- Migración aditiva: tres columnas nullable, sin borrar ni reescribir nada.

-- AlterTable
ALTER TABLE "ProfessionalProfile"
  ADD COLUMN IF NOT EXISTS "domicilio" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "iban"      VARCHAR(34);

-- AlterTable
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "locationNotes" TEXT;
