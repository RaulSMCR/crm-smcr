ALTER TABLE "Service"
ADD COLUMN "cabysCode" TEXT,
ADD COLUMN "taxId" TEXT;

CREATE INDEX "Service_taxId_idx" ON "Service"("taxId");

ALTER TABLE "Service"
ADD CONSTRAINT "Service_taxId_fkey"
FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;
