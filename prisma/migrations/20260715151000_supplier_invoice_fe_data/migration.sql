ALTER TABLE "Invoice"
ADD COLUMN "attachmentUrl" TEXT,
ADD COLUMN "xmlUrl" TEXT,
ADD COLUMN "supplierFeClave" VARCHAR(50),
ADD COLUMN "supplierIdNumber" VARCHAR(32),
ADD COLUMN "acceptanceStatus" TEXT,
ADD COLUMN "acceptanceAt" TIMESTAMP(3);
