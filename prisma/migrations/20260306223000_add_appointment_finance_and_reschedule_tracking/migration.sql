-- SAFE-ONLY: add reschedule tracking to appointments and optional appointment link to invoices

ALTER TABLE "Appointment"
ADD COLUMN "lastRescheduledBy" TEXT,
ADD COLUMN "lastRescheduledAt" TIMESTAMP(3),
ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Invoice"
ADD COLUMN "appointmentId" TEXT;

CREATE INDEX "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
