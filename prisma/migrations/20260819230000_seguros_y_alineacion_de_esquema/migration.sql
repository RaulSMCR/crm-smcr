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
DO $$ BEGIN
  CREATE TYPE "InsuranceClaimStatus" AS ENUM ('AWAITING_TEMPLATE', 'PENDING_SIGNED_FORM', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
-- Ya aplicado en la primera corrida: este bloque trae su propio COMMIT, así que
-- sobrevivió a la reversión del resto del script. Se deja documentado y neutro
-- porque no es reejecutable (el tipo _old ya no existe).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentTransactionStatus' AND e.enumlabel = 'LINK_SENT'
  ) THEN
    ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'LINK_SENT';
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Product_isActive_canBeSold_canBePurchased_idx";

-- DropIndex
DROP INDEX IF EXISTS "ProfessionalProfile_profileReviewStatus_idx";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS     "feErrorMessage" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS     "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "insuranceBlankFormUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "insuranceBlankFormUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "insuranceName" VARCHAR(128),
ADD COLUMN IF NOT EXISTS     "insurancePatientFormUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "insurancePatientFormUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "insuranceTemplateProId" TEXT,
ADD COLUMN IF NOT EXISTS     "insuranceTemplateUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "insuranceTemplateUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "useInsuranceForPayment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InsuranceClaim" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceClaim_appointmentId_key" ON "InsuranceClaim"("appointmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InsuranceClaim_patientId_idx" ON "InsuranceClaim"("patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InsuranceClaim_professionalId_idx" ON "InsuranceClaim"("professionalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InsuranceClaim_status_idx" ON "InsuranceClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Carousel_activeVersionId_key" ON "Carousel"("activeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_onvoEventId_key" ON "PaymentTransaction"("onvoEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceAssignment_onvoPaymentLinkId_idx" ON "ServiceAssignment"("onvoPaymentLinkId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceClaim_patientId_fkey') THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceClaim_appointmentId_fkey') THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceClaim_professionalId_fkey') THEN
    ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


-- NOTA para quien corra `prisma migrate diff` en el futuro.
--
-- Estos dos van a aparecer siempre como "faltantes" y no lo están:
--
--   PaymentTransaction_onvoEventId_key
--   ServiceAssignment_onvoPaymentLinkId_idx
--
-- Existen en la base como índices PARCIALES (`WHERE ... IS NOT NULL`), que es
-- deliberado y correcto: solo indexan las filas que tienen valor. Prisma no
-- sabe expresar un índice parcial en el schema, así que declara la versión
-- completa y el diff los reporta como diferencia para siempre.
--
-- No hay nada que aplicar. No los recrees sin el WHERE.
