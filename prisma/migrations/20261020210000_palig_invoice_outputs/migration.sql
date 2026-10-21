-- Adición opcional para el piloto PALIG. No altera reclamos ni facturas históricos.
ALTER TABLE "InsuranceClaim"
  ADD COLUMN "invoiceId" TEXT,
  ADD COLUMN "templateSnapshotUrl" TEXT,
  ADD COLUMN "generatedFormUrl" TEXT,
  ADD COLUMN "paymentProofUrl" TEXT;

CREATE UNIQUE INDEX "InsuranceClaim_invoiceId_key" ON "InsuranceClaim"("invoiceId");
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
