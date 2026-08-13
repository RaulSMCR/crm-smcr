-- Tarifas por lugar y franja horaria + lugares de atención del profesional.
--
-- Antes: ServiceAssignment.approvedSessionPrice, un único precio por
-- (profesional, servicio). No permitía cobrar distinto según dónde ni cuándo.
--
-- Ahora: ProfessionalRate, con alcance (servicio, lugar, franja) donde lugar y
-- franja pueden ir en NULL para decir "cualquiera". El precio se congela en la
-- cita al agendar (Appointment.pricePaid + copia del lugar).

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "LocationModality" AS ENUM ('OFFICE', 'HOME', 'VIRTUAL');
CREATE TYPE "RateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ── Lugares de atención ──────────────────────────────────────────────────────
CREATE TABLE "PracticeLocation" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "LocationModality" NOT NULL,
    "address" TEXT,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PracticeLocation_professionalId_name_key" ON "PracticeLocation"("professionalId", "name");
CREATE INDEX "PracticeLocation_professionalId_isActive_idx" ON "PracticeLocation"("professionalId", "isActive");

ALTER TABLE "PracticeLocation" ADD CONSTRAINT "PracticeLocation_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Franjas horarias propias de cada profesional ─────────────────────────────
CREATE TABLE "ProfessionalTimeBand" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalTimeBand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalTimeBand_professionalId_name_key" ON "ProfessionalTimeBand"("professionalId", "name");
CREATE INDEX "ProfessionalTimeBand_professionalId_idx" ON "ProfessionalTimeBand"("professionalId");

ALTER TABLE "ProfessionalTimeBand" ADD CONSTRAINT "ProfessionalTimeBand_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Tarifas ──────────────────────────────────────────────────────────────────
CREATE TABLE "ProfessionalRate" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locationId" TEXT,
    "timeBandId" TEXT,
    "proposedPrice" DECIMAL(10,2),
    "approvedPrice" DECIMAL(10,2),
    "status" "RateStatus" NOT NULL DEFAULT 'PENDING',
    "adminReviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfessionalRate_professionalId_serviceId_idx" ON "ProfessionalRate"("professionalId", "serviceId");
CREATE INDEX "ProfessionalRate_status_idx" ON "ProfessionalRate"("status");
CREATE INDEX "ProfessionalRate_locationId_idx" ON "ProfessionalRate"("locationId");
CREATE INDEX "ProfessionalRate_timeBandId_idx" ON "ProfessionalRate"("timeBandId");

-- Unicidad del alcance. No se puede usar UNIQUE normal: en Postgres dos NULL son
-- distintos entre sí, así que nada impediría dos tarifas "cualquiera/cualquiera"
-- para el mismo servicio. COALESCE a '' las vuelve comparables.
CREATE UNIQUE INDEX "ProfessionalRate_scope_key" ON "ProfessionalRate"(
    "professionalId", "serviceId", COALESCE("locationId", ''), COALESCE("timeBandId", '')
);

ALTER TABLE "ProfessionalRate" ADD CONSTRAINT "ProfessionalRate_professionalId_serviceId_fkey"
    FOREIGN KEY ("professionalId", "serviceId") REFERENCES "ServiceAssignment"("professionalId", "serviceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalRate" ADD CONSTRAINT "ProfessionalRate_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalRate" ADD CONSTRAINT "ProfessionalRate_timeBandId_fkey"
    FOREIGN KEY ("timeBandId") REFERENCES "ProfessionalTimeBand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Lugares ofrecidos en cada bloque de disponibilidad ───────────────────────
CREATE TABLE "AvailabilityLocation" (
    "availabilityId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "AvailabilityLocation_pkey" PRIMARY KEY ("availabilityId", "locationId")
);

CREATE INDEX "AvailabilityLocation_locationId_idx" ON "AvailabilityLocation"("locationId");

ALTER TABLE "AvailabilityLocation" ADD CONSTRAINT "AvailabilityLocation_availabilityId_fkey"
    FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityLocation" ADD CONSTRAINT "AvailabilityLocation_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Congelado en la cita ─────────────────────────────────────────────────────
ALTER TABLE "Appointment" ADD COLUMN "rateId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "locationId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "modality" "LocationModality";
ALTER TABLE "Appointment" ADD COLUMN "locationName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "locationAddress" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "timeBandName" TEXT;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rateId_fkey"
    FOREIGN KEY ("rateId") REFERENCES "ProfessionalRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Volcado de datos ─────────────────────────────────────────────────────────
-- Cada precio ya aprobado pasa a ser una tarifa "cualquier lugar / cualquier
-- franja", de modo que quien ya cobraba sigue cobrando igual sin tocar nada.
INSERT INTO "ProfessionalRate" (
    "id", "professionalId", "serviceId", "locationId", "timeBandId",
    "proposedPrice", "approvedPrice", "status", "requestedAt", "reviewedAt",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    sa."professionalId",
    sa."serviceId",
    NULL,
    NULL,
    sa."proposedSessionPrice",
    sa."approvedSessionPrice",
    'APPROVED'::"RateStatus",
    sa."requestedAt",
    sa."reviewedAt",
    NOW(),
    NOW()
FROM "ServiceAssignment" sa
WHERE sa."approvedSessionPrice" IS NOT NULL;

-- Las citas existentes conservan su pricePaid; se les enlaza la tarifa migrada
-- para que la trazabilidad no empiece en blanco.
UPDATE "Appointment" a
SET "rateId" = r."id"
FROM "ProfessionalRate" r
WHERE a."serviceId" IS NOT NULL
  AND r."professionalId" = a."professionalId"
  AND r."serviceId" = a."serviceId"
  AND r."locationId" IS NULL
  AND r."timeBandId" IS NULL;
