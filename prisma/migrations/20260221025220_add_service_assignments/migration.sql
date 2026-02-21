/*
  Warnings:

  - You are about to drop the `_ProfessionalProfileToService` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceAssignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToService" DROP CONSTRAINT "_ProfessionalProfileToService_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToService" DROP CONSTRAINT "_ProfessionalProfileToService_B_fkey";

-- DropTable
DROP TABLE "_ProfessionalProfileToService";

-- CreateTable
CREATE TABLE "ServiceAssignment" (
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "ServiceAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("professionalId","serviceId")
);

-- CreateIndex
CREATE INDEX "ServiceAssignment_serviceId_idx" ON "ServiceAssignment"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceAssignment_professionalId_idx" ON "ServiceAssignment"("professionalId");

-- CreateIndex
CREATE INDEX "ServiceAssignment_status_idx" ON "ServiceAssignment"("status");

-- CreateIndex
CREATE INDEX "ServiceAssignment_requestedAt_idx" ON "ServiceAssignment"("requestedAt");

-- CreateIndex
CREATE INDEX "ServiceAssignment_reviewedAt_idx" ON "ServiceAssignment"("reviewedAt");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE INDEX "Service_title_idx" ON "Service"("title");

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
