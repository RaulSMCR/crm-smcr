ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "parentAppointmentId" TEXT;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_parentAppointmentId_fkey"
  FOREIGN KEY ("parentAppointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Appointment_parentAppointmentId_idx" ON "Appointment"("parentAppointmentId");
