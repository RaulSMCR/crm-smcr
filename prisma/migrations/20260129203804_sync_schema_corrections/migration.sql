/*
  Warnings:

  - The primary key for the `Appointment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cancelReason` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `canceledAt` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `googleEventId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `priceFinal` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `professionalServiceId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Appointment` table. All the data in the column will be lost.
  - The `status` column on the `Appointment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Post` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `approvedAt` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `approvedByUserId` on the `Post` table. All the data in the column will be lost.
  - The primary key for the `Professional` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `approvedAt` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `approvedByUserId` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `googleCalendarId` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `googleRefreshToken` on the `Professional` table. All the data in the column will be lost.
  - You are about to drop the column `timeZone` on the `Professional` table. All the data in the column will be lost.
  - The primary key for the `Service` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `categoryId` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `durationMin` on the `Service` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServicesOnProfessionals` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `date` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'DRAFT';

-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'ARTICLE';

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_professionalServiceId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_approvedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Professional" DROP CONSTRAINT "Professional_approvedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ServicesOnProfessionals" DROP CONSTRAINT "ServicesOnProfessionals_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "ServicesOnProfessionals" DROP CONSTRAINT "ServicesOnProfessionals_serviceId_fkey";

-- DropIndex
DROP INDEX "Appointment_googleEventId_key";

-- DropIndex
DROP INDEX "Appointment_professionalId_startTime_idx";

-- DropIndex
DROP INDEX "Appointment_status_idx";

-- DropIndex
DROP INDEX "Appointment_userId_startTime_idx";

-- DropIndex
DROP INDEX "Post_serviceId_idx";

-- DropIndex
DROP INDEX "Post_status_createdAt_idx";

-- DropIndex
DROP INDEX "Professional_email_idx";

-- DropIndex
DROP INDEX "Professional_isApproved_idx";

-- DropIndex
DROP INDEX "Professional_profession_idx";

-- DropIndex
DROP INDEX "Service_categoryId_idx";

-- DropIndex
DROP INDEX "User_email_idx";

-- DropIndex
DROP INDEX "User_identification_key";

-- AlterTable
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_pkey",
DROP COLUMN "cancelReason",
DROP COLUMN "canceledAt",
DROP COLUMN "endTime",
DROP COLUMN "googleEventId",
DROP COLUMN "priceFinal",
DROP COLUMN "professionalServiceId",
DROP COLUMN "startTime",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "professionalId" SET DATA TYPE TEXT,
ALTER COLUMN "serviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Appointment_id_seq";

-- AlterTable
ALTER TABLE "Post" DROP CONSTRAINT "Post_pkey",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedByUserId",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "excerpt" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "postType" SET DEFAULT 'ARTICLE',
ALTER COLUMN "authorId" DROP NOT NULL,
ALTER COLUMN "authorId" SET DATA TYPE TEXT,
ALTER COLUMN "serviceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Post_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Post_id_seq";

-- AlterTable
ALTER TABLE "Professional" DROP CONSTRAINT "Professional_pkey",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedByUserId",
DROP COLUMN "googleCalendarId",
DROP COLUMN "googleRefreshToken",
DROP COLUMN "timeZone",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "resetLastSentAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenExp" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "verifyEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN     "verifyTokenExp" TIMESTAMP(3),
ADD COLUMN     "verifyTokenHash" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL,
ADD CONSTRAINT "Professional_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Professional_id_seq";

-- AlterTable
ALTER TABLE "Service" DROP CONSTRAINT "Service_pkey",
DROP COLUMN "categoryId",
DROP COLUMN "durationMin",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "price" SET DEFAULT 0.0,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30),
ADD CONSTRAINT "Service_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Service_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resetLastSentAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenExp" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "verifyEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN     "verifyTokenExp" TIMESTAMP(3),
ADD COLUMN     "verifyTokenHash" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "timeZone" DROP NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "ServicesOnProfessionals";

-- DropEnum
DROP TYPE "AppointmentStatus";

-- DropEnum
DROP TYPE "ProfessionalServiceStatus";

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "professionalId" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfessionalToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Availability_professionalId_idx" ON "Availability"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "_ProfessionalToService_AB_unique" ON "_ProfessionalToService"("A", "B");

-- CreateIndex
CREATE INDEX "_ProfessionalToService_B_index" ON "_ProfessionalToService"("B");

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalToService" ADD CONSTRAINT "_ProfessionalToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalToService" ADD CONSTRAINT "_ProfessionalToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
