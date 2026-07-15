CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT appointment_no_overlap
EXCLUDE USING gist (
  "professionalId" WITH =,
  tstzrange("date", "endDate", '[)') WITH &&
)
WHERE ("status" IN ('PENDING'::"AppointmentStatus", 'CONFIRMED'::"AppointmentStatus"));

