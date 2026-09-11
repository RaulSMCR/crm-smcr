-- Hubs profesionales configurables: estructura aditiva, sin duplicar tarifas
-- ni disponibilidad del perfil profesional.

CREATE TYPE "ProfessionalHubStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "ProfessionalHub" (
  "id" TEXT NOT NULL,
  "professionalProfileId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "profileSlug" TEXT NOT NULL,
  "whatsapp" TEXT,
  "modality" TEXT,
  "durationMin" INTEGER,
  "featuredSeriesSlug" TEXT,
  "heroVideoUrl" TEXT,
  "heroPosterUrl" TEXT,
  "logoUrl" TEXT,
  "enabledFunctions" JSONB,
  "status" "ProfessionalHubStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalHub_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfessionalHubModule" (
  "id" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TOPIC',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "body" TEXT,
  "metadata" JSONB,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalHubModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalHub_professionalProfileId_key" ON "ProfessionalHub"("professionalProfileId");
CREATE UNIQUE INDEX "ProfessionalHub_slug_key" ON "ProfessionalHub"("slug");
CREATE INDEX "ProfessionalHub_status_isActive_idx" ON "ProfessionalHub"("status", "isActive");
CREATE INDEX "ProfessionalHub_profileSlug_idx" ON "ProfessionalHub"("profileSlug");
CREATE UNIQUE INDEX "ProfessionalHubModule_hubId_slug_key" ON "ProfessionalHubModule"("hubId", "slug");
CREATE INDEX "ProfessionalHubModule_hubId_isVisible_isPublished_position_idx" ON "ProfessionalHubModule"("hubId", "isVisible", "isPublished", "position");

ALTER TABLE "ProfessionalHub" ADD CONSTRAINT "ProfessionalHub_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalHubModule" ADD CONSTRAINT "ProfessionalHubModule_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "ProfessionalHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
