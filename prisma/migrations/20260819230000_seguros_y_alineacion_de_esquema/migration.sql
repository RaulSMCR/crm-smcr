-- Alineación del esquema tras la reaplicación de migraciones del 2026-08-19.
--
-- La funcionalidad de seguros (InsuranceClaim, los campos de seguro en User,
-- InsuranceClaimStatus) estaba en producción pero no tenía migración: se había
-- aplicado con `db push`. Al reaplicarse el historial, se perdió.
--
-- Este archivo es el diff entre el historial de migraciones y prisma/schema.prisma,
-- generado con `prisma migrate diff`. Deja el esquema del repo como única fuente
-- de verdad, que es lo que faltaba.

-- CreateEnum
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('AWAITING_TEMPLATE', 'PENDING_SIGNED_FORM', 'COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentTransactionStatus_new" AS ENUM ('PENDING', 'LINK_SENT', 'APPROVED', 'REJECTED', 'REFUNDED', 'EXPIRED');
ALTER TABLE "PaymentTransaction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentTransaction" ALTER COLUMN "status" TYPE "PaymentTransactionStatus_new" USING ("status"::text::"PaymentTransactionStatus_new");
ALTER TYPE "PaymentTransactionStatus" RENAME TO "PaymentTransactionStatus_old";
ALTER TYPE "PaymentTransactionStatus_new" RENAME TO "PaymentTransactionStatus";
DROP TYPE "PaymentTransactionStatus_old";
ALTER TABLE "PaymentTransaction" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "Product_isActive_canBeSold_canBePurchased_idx";

-- DropIndex
DROP INDEX "ProfessionalProfile_profileReviewStatus_idx";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "feErrorMessage" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insuranceBlankFormUploadedAt" TIMESTAMP(3),
ADD COLUMN     "insuranceBlankFormUrl" TEXT,
ADD COLUMN     "insuranceName" VARCHAR(128),
ADD COLUMN     "insurancePatientFormUploadedAt" TIMESTAMP(3),
ADD COLUMN     "insurancePatientFormUrl" TEXT,
ADD COLUMN     "insuranceTemplateProId" TEXT,
ADD COLUMN     "insuranceTemplateUploadedAt" TIMESTAMP(3),
ADD COLUMN     "insuranceTemplateUrl" TEXT,
ADD COLUMN     "useInsuranceForPayment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "signedFormUrl" TEXT,
    "signedFormUploadedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'AWAITING_TEMPLATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_appointmentId_key" ON "InsuranceClaim"("appointmentId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_patientId_idx" ON "InsuranceClaim"("patientId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_professionalId_idx" ON "InsuranceClaim"("professionalId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_status_idx" ON "InsuranceClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Carousel_activeVersionId_key" ON "Carousel"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_onvoEventId_key" ON "PaymentTransaction"("onvoEventId");

-- CreateIndex
CREATE INDEX "ServiceAssignment_onvoPaymentLinkId_idx" ON "ServiceAssignment"("onvoPaymentLinkId");

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

