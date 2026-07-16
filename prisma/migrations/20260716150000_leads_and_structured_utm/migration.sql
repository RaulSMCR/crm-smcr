-- Pipeline de leads + atribución UTM estructurada.
-- Lead: contactos de formularios públicos (contacto/FAQ) con estado y origen.
-- User: detalle UTM sin colapsar (acquisitionChannel/campaignName se conservan).

CREATE TYPE "LeadChannel" AS ENUM ('CONTACT_FORM', 'FAQ_FORM', 'WHATSAPP');

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED');

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "channel" "LeadChannel" NOT NULL DEFAULT 'CONTACT_FORM',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "landingPath" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT,
  ADD COLUMN "referrer" TEXT,
  ADD COLUMN "landingPath" TEXT;
