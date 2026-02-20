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

    CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("professionalId","serviceId")
);

-- CreateIndex
CREATE INDEX "ServiceAssignment_serviceId_status_idx" ON "ServiceAssignment"("serviceId", "status");

-- CreateIndex
CREATE INDEX "ServiceAssignment_professionalId_status_idx" ON "ServiceAssignment"("professionalId", "status");

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
