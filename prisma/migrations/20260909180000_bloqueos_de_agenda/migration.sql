-- Bloqueos de agenda: los ratos en que el profesional no atiende.
--
-- `Availability` describe la semana tipo; esto le resta excepciones puntuales
-- (vacaciones, un viaje, una urgencia). Se guardan instantes absolutos, igual
-- que en Appointment, para que el solapamiento se evalúe sin reinterpretar
-- zonas horarias en cada consulta.

CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- Cubre la consulta de solapamiento, que siempre filtra por profesional y por
-- rango de fechas.
CREATE INDEX "ScheduleBlock_professionalId_startsAt_endsAt_idx"
    ON "ScheduleBlock"("professionalId", "startsAt", "endsAt");

ALTER TABLE "ScheduleBlock"
    ADD CONSTRAINT "ScheduleBlock_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
