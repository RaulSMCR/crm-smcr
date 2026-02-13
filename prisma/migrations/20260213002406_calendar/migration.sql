/*
  Warnings:

  - The values [PENDING] on the enum `PostStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to alter the column `pricePaid` on the `Appointment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to drop the column `isActive` on the `Availability` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `approvedById` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `mediaUrl` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `postType` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `serviceId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Service` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to drop the column `birthDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `identification` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `interests` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `timeZone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Professional` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CategoryToProfessional` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProfessionalToService` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[professionalId,dayOfWeek,startTime,endTime]` on the table `Availability` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `patientId` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Made the column `endDate` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Availability` table without a default value. This is not possible if the table is not empty.
  - Made the column `authorId` on table `Post` required. This step will fail if there are existing NULL values in that column.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PostStatus_new" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
ALTER TABLE "Post" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "status" TYPE "PostStatus_new" USING ("status"::text::"PostStatus_new");
ALTER TYPE "PostStatus" RENAME TO "PostStatus_old";
ALTER TYPE "PostStatus_new" RENAME TO "PostStatus";
DROP TYPE "PostStatus_old";
ALTER TABLE "Post" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_professionalId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Professional" DROP CONSTRAINT "Professional_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToProfessional" DROP CONSTRAINT "_CategoryToProfessional_A_fkey";

-- DropForeignKey
ALTER TABLE "_CategoryToProfessional" DROP CONSTRAINT "_CategoryToProfessional_B_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalToService" DROP CONSTRAINT "_ProfessionalToService_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalToService" DROP CONSTRAINT "_ProfessionalToService_B_fkey";

-- DropIndex
DROP INDEX "Availability_professionalId_idx";

-- DropIndex
DROP INDEX "Service_slug_key";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "userId",
ADD COLUMN     "commissionFee" DECIMAL(10,2),
ADD COLUMN     "meetLink" TEXT,
ADD COLUMN     "patientId" TEXT NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL,
ALTER COLUMN "pricePaid" DROP NOT NULL,
ALTER COLUMN "pricePaid" DROP DEFAULT,
ALTER COLUMN "pricePaid" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Availability" DROP COLUMN "isActive",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "icon",
DROP COLUMN "parentId";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "approvedById",
DROP COLUMN "imageUrl",
DROP COLUMN "mediaUrl",
DROP COLUMN "postType",
DROP COLUMN "serviceId",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "metaDesc" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "readingTime" INTEGER,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "authorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "imageUrl",
DROP COLUMN "slug",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "price" DROP DEFAULT,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "durationMin" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "birthDate",
DROP COLUMN "gender",
DROP COLUMN "identification",
DROP COLUMN "interests",
DROP COLUMN "timeZone",
ADD COLUMN     "acquisitionChannel" TEXT,
ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ALTER COLUMN "passwordHash" SET NOT NULL;

-- DropTable
DROP TABLE "Professional";

-- DropTable
DROP TABLE "_CategoryToProfessional";

-- DropTable
DROP TABLE "_ProfessionalToService";

-- DropEnum
DROP TYPE "PostType";

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "bio" TEXT,
    "coverLetter" TEXT,
    "cvUrl" TEXT,
    "introVideoUrl" TEXT,
    "avatarUrl" TEXT,
    "calendarUrl" TEXT,
    "googleRefreshToken" TEXT,
    "paymentLinkBase" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(2,1),
    "commission" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfessionalProfileToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_slug_key" ON "ProfessionalProfile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "_ProfessionalProfileToService_AB_unique" ON "_ProfessionalProfileToService"("A", "B");

-- CreateIndex
CREATE INDEX "_ProfessionalProfileToService_B_index" ON "_ProfessionalProfileToService"("B");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_professionalId_idx" ON "Appointment"("professionalId");

-- CreateIndex
CREATE INDEX "Availability_professionalId_dayOfWeek_idx" ON "Availability"("professionalId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_professionalId_dayOfWeek_startTime_endTime_key" ON "Availability"("professionalId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Post_views_idx" ON "Post"("views");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToService" ADD CONSTRAINT "_ProfessionalProfileToService_A_fkey" FOREIGN KEY ("A") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToService" ADD CONSTRAINT "_ProfessionalProfileToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
