-- CreateTable
CREATE TABLE "UnmatchedPayment" (
    "id" TEXT NOT NULL,
    "onvoEventId" TEXT NOT NULL,
    "onvoLinkId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "customerEmail" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmatchedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedPayment_onvoEventId_key" ON "UnmatchedPayment"("onvoEventId");

-- CreateIndex
CREATE INDEX "UnmatchedPayment_createdAt_idx" ON "UnmatchedPayment"("createdAt");
