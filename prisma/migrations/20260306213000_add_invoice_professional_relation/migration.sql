-- SAFE-ONLY: add optional professional relation to invoices
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "professionalId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_professionalId_idx" ON "Invoice"("professionalId");

DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;
