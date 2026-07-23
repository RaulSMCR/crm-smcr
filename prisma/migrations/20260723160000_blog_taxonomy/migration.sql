-- Taxonomia de la biblioteca del blog: disciplinas, temas, series y temas
-- complementarios. Migracion ADITIVA: crea tablas nuevas y agrega columnas
-- opcionales a "Post" (seriesId, seriesOrder, seriesApproved). No altera ni
-- borra datos existentes; ningun articulo publicado se pierde.

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('SUGGESTED', 'APPROVED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "seriesApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesOrder" INTEGER;

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicComplement" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicComplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostDiscipline" (
    "postId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostDiscipline_pkey" PRIMARY KEY ("postId","disciplineId")
);

-- CreateTable
CREATE TABLE "PostTopic" (
    "postId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTopic_pkey" PRIMARY KEY ("postId","topicId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_name_key" ON "Discipline"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_slug_key" ON "Discipline"("slug");

-- CreateIndex
CREATE INDEX "Discipline_isActive_order_idx" ON "Discipline"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_name_key" ON "Topic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Topic_isActive_order_idx" ON "Topic"("isActive", "order");

-- CreateIndex
CREATE INDEX "TopicComplement_toId_idx" ON "TopicComplement"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicComplement_fromId_toId_key" ON "TopicComplement"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "Series_name_key" ON "Series"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE INDEX "Series_isActive_idx" ON "Series"("isActive");

-- CreateIndex
CREATE INDEX "PostDiscipline_disciplineId_status_idx" ON "PostDiscipline"("disciplineId", "status");

-- CreateIndex
CREATE INDEX "PostTopic_topicId_status_idx" ON "PostTopic"("topicId", "status");

-- CreateIndex
CREATE INDEX "Post_seriesId_idx" ON "Post"("seriesId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicComplement" ADD CONSTRAINT "TopicComplement_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicComplement" ADD CONSTRAINT "TopicComplement_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDiscipline" ADD CONSTRAINT "PostDiscipline_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostDiscipline" ADD CONSTRAINT "PostDiscipline_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTopic" ADD CONSTRAINT "PostTopic_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTopic" ADD CONSTRAINT "PostTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

