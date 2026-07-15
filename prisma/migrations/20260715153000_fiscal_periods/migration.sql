CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ivaDebito" DECIMAL(15,2),
    "ivaCredito" DECIMAL(15,2),
    "ivaNeto" DECIMAL(15,2),
    "withholdings" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "filedAt" TIMESTAMP(3),
    "filedReceipt" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FiscalPeriod_year_month_key" ON "FiscalPeriod"("year", "month");
