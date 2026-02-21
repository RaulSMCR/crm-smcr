-- AlterTable
ALTER TABLE "User" ADD COLUMN     "identification" VARCHAR(32);

-- CreateIndex
CREATE INDEX "User_identification_idx" ON "User"("identification");
