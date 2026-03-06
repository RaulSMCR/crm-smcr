-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('DEPOSIT_50', 'BALANCE_50', 'FULL_100');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'REFUNDED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "isFirstWithProfessional" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "PaymentTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CRC',
    "p2pRequestId" INTEGER,
    "p2pReference" TEXT,
    "p2pProcessUrl" TEXT,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "p2pStatusCode" TEXT,
    "p2pStatusMessage" TEXT,
    "p2pPaymentDate" TIMESTAMP(3),
    "webhookPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_p2pRequestId_key" ON "PaymentTransaction"("p2pRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_p2pReference_key" ON "PaymentTransaction"("p2pReference");

-- CreateIndex
CREATE INDEX "PaymentTransaction_appointmentId_idx" ON "PaymentTransaction"("appointmentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_professionalId_idx" ON "PaymentTransaction"("professionalId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_patientId_idx" ON "PaymentTransaction"("patientId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_p2pRequestId_idx" ON "PaymentTransaction"("p2pRequestId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_createdAt_idx" ON "PaymentTransaction"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
