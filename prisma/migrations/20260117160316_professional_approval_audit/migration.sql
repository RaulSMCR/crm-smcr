-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" INTEGER,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resetLastSentAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenExp" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ADD COLUMN     "resumeUrl" TEXT,
ADD COLUMN     "verifyEmailLastSentAt" TIMESTAMP(3),
ADD COLUMN     "verifyTokenExp" TIMESTAMP(3),
ADD COLUMN     "verifyTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "Professional_emailVerified_idx" ON "Professional"("emailVerified");

-- CreateIndex
CREATE INDEX "Professional_approvedByUserId_idx" ON "Professional"("approvedByUserId");

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
