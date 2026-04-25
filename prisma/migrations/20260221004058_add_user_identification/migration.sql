-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "identification" VARCHAR(32);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_identification_idx" ON "User"("identification");
