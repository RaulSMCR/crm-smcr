-- Acuerdos de atención: pacientes que se atienden con periodicidad fija y sin
-- fecha de fin (ver el modelo AcuerdoDeAtencion en schema.prisma).
--
-- Aditiva e idempotente: tabla, columna e índices con IF NOT EXISTS y claves
-- foráneas con chequeo en pg_constraint, para poder reintentarla si una corrida
-- queda a medias. Aplicar con `prisma migrate deploy` o en el SQL Editor de
-- Supabase; nunca con migrate dev ni migrate reset.
--
-- Hay que aplicarla ANTES de desplegar: el cliente de Prisma generado con este
-- schema pide `Appointment.acuerdoId`, y sin la columna falla toda consulta a
-- citas, no solo la funcionalidad nueva.

CREATE TABLE IF NOT EXISTS "AcuerdoDeAtencion" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "locationId" TEXT,
  "modality" "LocationModality",
  "locationName" TEXT,
  "periodicidad" VARCHAR(16) NOT NULL,
  "inicio" TIMESTAMPTZ(6) NOT NULL,
  "duracionMin" INTEGER NOT NULL,
  "fin" TIMESTAMPTZ(6),
  "precioAcordado" DECIMAL(10,2) NOT NULL,
  "estado" VARCHAR(16) NOT NULL DEFAULT 'ACTIVO',
  "gcalEventId" TEXT,
  "meetLink" TEXT,
  "generadoHasta" TIMESTAMPTZ(6),
  "notas" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcuerdoDeAtencion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AcuerdoDeAtencion_professionalId_estado_idx" ON "AcuerdoDeAtencion"("professionalId", "estado");
CREATE INDEX IF NOT EXISTS "AcuerdoDeAtencion_patientId_idx" ON "AcuerdoDeAtencion"("patientId");

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "acuerdoId" TEXT;
CREATE INDEX IF NOT EXISTS "Appointment_acuerdoId_idx" ON "Appointment"("acuerdoId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcuerdoDeAtencion_patientId_fkey') THEN
    ALTER TABLE "AcuerdoDeAtencion" ADD CONSTRAINT "AcuerdoDeAtencion_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcuerdoDeAtencion_professionalId_fkey') THEN
    ALTER TABLE "AcuerdoDeAtencion" ADD CONSTRAINT "AcuerdoDeAtencion_professionalId_fkey"
      FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcuerdoDeAtencion_serviceId_fkey') THEN
    ALTER TABLE "AcuerdoDeAtencion" ADD CONSTRAINT "AcuerdoDeAtencion_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcuerdoDeAtencion_locationId_fkey') THEN
    ALTER TABLE "AcuerdoDeAtencion" ADD CONSTRAINT "AcuerdoDeAtencion_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_acuerdoId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_acuerdoId_fkey"
      FOREIGN KEY ("acuerdoId") REFERENCES "AcuerdoDeAtencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Acceso exclusivamente a través del servidor. No conceder permisos a anon/authenticated.
ALTER TABLE "AcuerdoDeAtencion" ENABLE ROW LEVEL SECURITY;
