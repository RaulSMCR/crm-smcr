-- Frase diaria: elección del admin y verificación de fuentes.
-- Migración aditiva: no toca ninguna tabla existente.

-- CreateEnum
CREATE TYPE "PhrasePickStatus" AS ENUM ('APPROVED', 'SUBSTITUTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DailyPhrasePick" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "phraseIndex" INTEGER NOT NULL,
    "phraseText" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "corpusVersion" TEXT NOT NULL,
    "audience" TEXT,
    "slot" INTEGER,
    "status" "PhrasePickStatus" NOT NULL DEFAULT 'APPROVED',
    "note" TEXT,
    "decidedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPhrasePick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseSourceCheck" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhraseSourceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyPhrasePick_date_key" ON "DailyPhrasePick"("date");

-- CreateIndex
CREATE INDEX "DailyPhrasePick_status_idx" ON "DailyPhrasePick"("status");

-- CreateIndex
CREATE INDEX "DailyPhrasePick_sourceKey_idx" ON "DailyPhrasePick"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PhraseSourceCheck_sourceKey_key" ON "PhraseSourceCheck"("sourceKey");

-- CreateIndex
CREATE INDEX "PhraseSourceCheck_verified_idx" ON "PhraseSourceCheck"("verified");
