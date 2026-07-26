-- Casilla de mensajes del admin: difusión de una vía con acuse de lectura.
-- Migración aditiva: no toca ninguna tabla existente.

-- CreateEnum
CREATE TYPE "MessageTargetKind" AS ENUM ('ALL', 'AUDIENCE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetKind" "MessageTargetKind" NOT NULL DEFAULT 'ALL',
    "targetAudiences" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "pushSent" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audience" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMessage_status_sentAt_idx" ON "AdminMessage"("status", "sentAt");

-- CreateIndex
CREATE INDEX "AdminMessageRecipient_userId_readAt_idx" ON "AdminMessageRecipient"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AdminMessageRecipient_messageId_idx" ON "AdminMessageRecipient"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMessageRecipient_messageId_userId_key" ON "AdminMessageRecipient"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "AdminMessageRecipient" ADD CONSTRAINT "AdminMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AdminMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessageRecipient" ADD CONSTRAINT "AdminMessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
