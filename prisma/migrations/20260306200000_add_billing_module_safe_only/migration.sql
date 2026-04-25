-- SAFE-ONLY MIGRATION
-- Objetivo: agregar módulo de facturación sin afectar datos actuales de agenda/pagos.

-- ---------------------------------------------------------------------------
-- 1) ENUMS NUEVOS (idempotentes)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "InvoiceType" AS ENUM ('CUSTOMER_INVOICE','SUPPLIER_INVOICE','CUSTOMER_CREDIT_NOTE','SUPPLIER_CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','OPEN','PAID','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE "FEStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('FACTURA_ELECTRONICA','NOTA_CREDITO','NOTA_DEBITO','TIQUETE_ELECTRONICO');
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  CREATE TYPE "TaxScope" AS ENUM ('SALES','PURCHASES','BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

-- ---------------------------------------------------------------------------
-- 2) TABLAS NUEVAS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tax" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate" DECIMAL(5,2) NOT NULL,
  "scope" "TaxScope" NOT NULL,
  "label" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "internalReference" TEXT,
  "productType" TEXT NOT NULL DEFAULT 'service',
  "cabysCode" TEXT,
  "category" TEXT DEFAULT 'All',
  "salePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "saleTaxId" TEXT,
  "purchaseTaxId" TEXT,
  "saleUom" TEXT DEFAULT 'Unidad(es)',
  "purchaseUom" TEXT DEFAULT 'Unidad(es)',
  "incomeAccount" TEXT,
  "expenseAccount" TEXT,
  "canBeSold" BOOLEAN NOT NULL DEFAULT true,
  "canBePurchased" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
  "id" TEXT NOT NULL,
  "sequenceType" "InvoiceType" NOT NULL,
  "prefix" TEXT,
  "currentNumber" INTEGER NOT NULL DEFAULT 0,
  "year" INTEGER NOT NULL,
  "padding" INTEGER NOT NULL DEFAULT 4,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceType" "InvoiceType" NOT NULL,
  "feNumber" TEXT,
  "feClave" TEXT,
  "feStatus" "FEStatus" NOT NULL DEFAULT 'PENDING',
  "documentType" "DocumentType" NOT NULL DEFAULT 'FACTURA_ELECTRONICA',
  "contactId" TEXT NOT NULL,
  "contactName" TEXT,
  "contactIdNumber" TEXT,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paymentDate" TIMESTAMP(3),
  "economicActivity" TEXT,
  "paymentMethod" TEXT DEFAULT 'transfer',
  "currency" TEXT NOT NULL DEFAULT 'CRC',
  "supplierReference" TEXT,
  "supplierEconomicActivity" TEXT,
  "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "originInvoiceId" TEXT,
  "originDocument" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "productId" TEXT,
  "serviceId" TEXT,
  "productName" TEXT NOT NULL,
  "description" TEXT,
  "cabysCode" TEXT,
  "accountCode" TEXT,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitOfMeasure" TEXT DEFAULT 'Unidad(es)',
  "unitPrice" DECIMAL(15,2) NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discountType" TEXT,
  "taxId" TEXT,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "lineSubtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3) ÍNDICES
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSequence_sequenceType_key"              ON "InvoiceSequence"("sequenceType");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceType_invoiceNumber_key"          ON "Invoice"("invoiceType", "invoiceNumber");
CREATE INDEX        IF NOT EXISTS "Invoice_invoiceType_status_idx"                 ON "Invoice"("invoiceType", "status");
CREATE INDEX        IF NOT EXISTS "Invoice_contactId_idx"                          ON "Invoice"("contactId");
CREATE INDEX        IF NOT EXISTS "Invoice_invoiceDate_idx"                        ON "Invoice"("invoiceDate");
CREATE INDEX        IF NOT EXISTS "InvoiceLine_invoiceId_sortOrder_idx"            ON "InvoiceLine"("invoiceId", "sortOrder");
CREATE INDEX        IF NOT EXISTS "Tax_scope_isActive_idx"                         ON "Tax"("scope", "isActive");
CREATE INDEX        IF NOT EXISTS "Product_isActive_canBeSold_canBePurchased_idx"  ON "Product"("isActive", "canBeSold", "canBePurchased");

-- ---------------------------------------------------------------------------
-- 4) FOREIGN KEYS
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_saleTaxId_fkey"
    FOREIGN KEY ("saleTaxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_purchaseTaxId_fkey"
    FOREIGN KEY ("purchaseTaxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originInvoiceId_fkey"
    FOREIGN KEY ("originInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_taxId_fkey"
    FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;

-- ---------------------------------------------------------------------------
-- 5) SEED MÍNIMO (idempotente)
-- ---------------------------------------------------------------------------
INSERT INTO "Tax" ("id", "name", "rate", "scope", "label", "isActive")
SELECT 'tax_iva_4_sales', 'IVA (4%)', 4.00, 'SALES', 'IVA (4%)', true
WHERE NOT EXISTS (SELECT 1 FROM "Tax" WHERE "id" = 'tax_iva_4_sales');

INSERT INTO "Tax" ("id", "name", "rate", "scope", "label", "isActive")
SELECT 'tax_iva_13_sales', 'IVA (13%)', 13.00, 'SALES', 'IVA (13%)', true
WHERE NOT EXISTS (SELECT 1 FROM "Tax" WHERE "id" = 'tax_iva_13_sales');

INSERT INTO "Tax" ("id", "name", "rate", "scope", "label", "isActive")
SELECT 'tax_iva_13_purchases', 'IVA (13%)', 13.00, 'PURCHASES', 'IVA (13%)', true
WHERE NOT EXISTS (SELECT 1 FROM "Tax" WHERE "id" = 'tax_iva_13_purchases');

INSERT INTO "Product" (
  "id", "name", "description", "cabysCode", "salePrice", "productType",
  "canBeSold", "canBePurchased", "isActive", "createdAt", "updatedAt"
)
SELECT
  'product_servicios_profesionales',
  'Servicios Profesionales',
  'Servicios Profesionales',
  '9310201080103',
  1.00,
  'service',
  true,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Product" WHERE "id" = 'product_servicios_profesionales');

INSERT INTO "InvoiceSequence" ("id", "sequenceType", "prefix", "currentNumber", "year", "padding", "createdAt", "updatedAt")
SELECT 'seq_customer_invoice', 'CUSTOMER_INVOICE', '', 151, 2026, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceSequence" WHERE "sequenceType" = 'CUSTOMER_INVOICE');

INSERT INTO "InvoiceSequence" ("id", "sequenceType", "prefix", "currentNumber", "year", "padding", "createdAt", "updatedAt")
SELECT 'seq_supplier_invoice', 'SUPPLIER_INVOICE', 'FACT/', 6, 2025, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceSequence" WHERE "sequenceType" = 'SUPPLIER_INVOICE');

INSERT INTO "InvoiceSequence" ("id", "sequenceType", "prefix", "currentNumber", "year", "padding", "createdAt", "updatedAt")
SELECT 'seq_customer_credit_note', 'CUSTOMER_CREDIT_NOTE', '', 3, 2026, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceSequence" WHERE "sequenceType" = 'CUSTOMER_CREDIT_NOTE');

INSERT INTO "InvoiceSequence" ("id", "sequenceType", "prefix", "currentNumber", "year", "padding", "createdAt", "updatedAt")
SELECT 'seq_supplier_credit_note', 'SUPPLIER_CREDIT_NOTE', 'NC-PROV/', 0, 2026, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceSequence" WHERE "sequenceType" = 'SUPPLIER_CREDIT_NOTE');
