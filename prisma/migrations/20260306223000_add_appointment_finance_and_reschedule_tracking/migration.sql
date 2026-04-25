-- SAFE-ONLY: add reschedule tracking to appointments and optional appointment link to invoices

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "lastRescheduledBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastRescheduledAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rescheduleCount"    INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
