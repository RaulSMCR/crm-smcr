/*
  Warnings:

  - You are about to drop the column `resetLastSentAt` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenExp` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenHash` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `resumeUrl` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `verifyEmailLastSentAt` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `verifyTokenExp` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `verifyTokenHash` on the `Professional` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Appointment_professionalServiceId_startTime_idx";

-- DropIndex
DROP INDEX "Appointment_serviceId_idx";

-- DropIndex
DROP INDEX "Appointment_status_startTime_idx";

-- DropIndex
DROP INDEX "Professional_approvedByUserId_idx";

-- DropIndex
DROP INDEX "Professional_emailVerified_idx";

-- DropIndex
DROP INDEX "ServicesOnProfessionals_status_idx";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" INTEGER;

-- AlterTable
ALTER TABLE "Professional" DROP COLUMN "resetLastSentAt",
DROP COLUMN "resetTokenExp",
DROP COLUMN "resetTokenHash",
DROP COLUMN "resumeUrl",
DROP COLUMN "verifyEmailLastSentAt",
DROP COLUMN "verifyTokenExp",
DROP COLUMN "verifyTokenHash";

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
