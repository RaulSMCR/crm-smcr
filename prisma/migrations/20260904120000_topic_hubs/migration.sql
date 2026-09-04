-- Hubs temáticos editoriales: ampliación aditiva de la taxonomía existente.

CREATE TYPE "TopicStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TopicSectionType" AS ENUM ('HERO', 'USER_SITUATIONS', 'EDITORIAL_INTRO', 'FEATURED_ARTICLES', 'EXPLORE_TOPIC', 'PERSPECTIVES', 'VIDEO', 'PODCAST', 'FAQ', 'PROFESSIONALS', 'SERVICES', 'RELATED_TOPICS', 'CTA', 'CUSTOM_RICH_TEXT');
CREATE TYPE "TopicPostRole" AS ENUM ('PRIMARY', 'SUPPORTING');
CREATE TYPE "TopicPerspectiveStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TopicRelationType" AS ENUM ('RELATED');
CREATE TYPE "DisciplineStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Discipline"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "DisciplineStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Topic"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "excerpt" TEXT,
  ADD COLUMN "status" "TopicStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "heroImage" TEXT,
  ADD COLUMN "heroImageAlt" VARCHAR(300),
  ADD COLUMN "introVideoUrl" TEXT,
  ADD COLUMN "podcastUrl" TEXT,
  ADD COLUMN "metaTitle" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX "Discipline_status_isActive_idx" ON "Discipline"("status", "isActive");
CREATE INDEX "Topic_status_isActive_idx" ON "Topic"("status", "isActive");

ALTER TABLE "PostTopic"
  ADD COLUMN "role" "TopicPostRole" NOT NULL DEFAULT 'SUPPORTING',
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Appointment" ADD COLUMN "topicSlug" VARCHAR(80);
CREATE INDEX "Appointment_topicSlug_idx" ON "Appointment"("topicSlug");

CREATE TABLE "TopicSection" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "type" "TopicSectionType" NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopicSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopicService" (
  "topicId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopicService_pkey" PRIMARY KEY ("topicId", "serviceId")
);

CREATE TABLE "TopicPerspective" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "disciplineId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" "TopicPerspectiveStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopicPerspective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopicRelation" (
  "id" TEXT NOT NULL,
  "sourceTopicId" TEXT NOT NULL,
  "targetTopicId" TEXT NOT NULL,
  "relationType" "TopicRelationType" NOT NULL DEFAULT 'RELATED',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopicRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TopicFaq" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopicFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TopicSection_topicId_position_idx" ON "TopicSection"("topicId", "position");
CREATE INDEX "TopicSection_topicId_isVisible_position_idx" ON "TopicSection"("topicId", "isVisible", "position");
CREATE INDEX "TopicService_serviceId_idx" ON "TopicService"("serviceId");
CREATE INDEX "TopicService_topicId_featured_position_idx" ON "TopicService"("topicId", "featured", "position");
CREATE INDEX "TopicPerspective_topicId_status_position_idx" ON "TopicPerspective"("topicId", "status", "position");
CREATE INDEX "TopicPerspective_disciplineId_idx" ON "TopicPerspective"("disciplineId");
CREATE UNIQUE INDEX "TopicRelation_sourceTopicId_targetTopicId_relationType_key" ON "TopicRelation"("sourceTopicId", "targetTopicId", "relationType");
CREATE INDEX "TopicRelation_targetTopicId_relationType_idx" ON "TopicRelation"("targetTopicId", "relationType");
CREATE INDEX "TopicRelation_sourceTopicId_position_idx" ON "TopicRelation"("sourceTopicId", "position");
CREATE INDEX "TopicFaq_topicId_isVisible_position_idx" ON "TopicFaq"("topicId", "isVisible", "position");
CREATE INDEX "PostTopic_topicId_role_featured_position_idx" ON "PostTopic"("topicId", "role", "featured", "position");

ALTER TABLE "TopicSection" ADD CONSTRAINT "TopicSection_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicService" ADD CONSTRAINT "TopicService_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicService" ADD CONSTRAINT "TopicService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicPerspective" ADD CONSTRAINT "TopicPerspective_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicPerspective" ADD CONSTRAINT "TopicPerspective_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TopicRelation" ADD CONSTRAINT "TopicRelation_sourceTopicId_fkey" FOREIGN KEY ("sourceTopicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicRelation" ADD CONSTRAINT "TopicRelation_targetTopicId_fkey" FOREIGN KEY ("targetTopicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicFaq" ADD CONSTRAINT "TopicFaq_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
