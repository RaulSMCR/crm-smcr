CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "commissionPct" INTEGER NOT NULL,
    "commissionAmt" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SettlementItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "commissionAmt" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "SettlementItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Settlement_professionalId_periodStart_periodEnd_key" ON "Settlement"("professionalId", "periodStart", "periodEnd");
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");
CREATE UNIQUE INDEX "SettlementItem_transactionId_key" ON "SettlementItem"("transactionId");
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
