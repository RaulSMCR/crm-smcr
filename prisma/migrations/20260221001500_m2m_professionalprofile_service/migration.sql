/*
  Warnings:

  - You are about to drop the `ServiceAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ServiceAssignment" DROP CONSTRAINT "ServiceAssignment_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceAssignment" DROP CONSTRAINT "ServiceAssignment_serviceId_fkey";

-- DropTable
DROP TABLE "ServiceAssignment";

-- DropEnum
DROP TYPE "ServiceAssignmentStatus";

-- CreateTable
CREATE TABLE "_ProfessionalProfileToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProfessionalProfileToService_AB_unique" ON "_ProfessionalProfileToService"("A", "B");

-- CreateIndex
CREATE INDEX "_ProfessionalProfileToService_B_index" ON "_ProfessionalProfileToService"("B");

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToService" ADD CONSTRAINT "_ProfessionalProfileToService_A_fkey" FOREIGN KEY ("A") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToService" ADD CONSTRAINT "_ProfessionalProfileToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
