-- SAFE-ONLY: add optional professional relation to invoices
ALTER TABLE "Invoice"
ADD COLUMN "professionalId" TEXT;

CREATE INDEX "Invoice_professionalId_idx" ON "Invoice"("professionalId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
