-- Gasto publicitario por canal/mes (carga manual del admin) para el CAC.
CREATE TABLE "ChannelSpend" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelSpend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelSpend_source_month_key" ON "ChannelSpend"("source", "month");
CREATE INDEX "ChannelSpend_month_idx" ON "ChannelSpend"("month");
