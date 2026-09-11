-- Escalera de precios de lanzamiento.
--
-- Aditiva: tres tablas nuevas y una columna opcional en "Appointment". Nada
-- existente se modifica ni se borra.
--
-- Idempotente, para poder reintentarla si una corrida queda a medias: enum con
-- EXCEPTION, tablas e índices con IF NOT EXISTS y claves foráneas con chequeo en
-- pg_constraint. Aplicar con `npx prisma db execute --file <este archivo>
-- --schema ./prisma/schema.prisma` o `pnpm run migrate` (migrate deploy). Nunca
-- con migrate dev ni migrate reset.
--
-- Mientras no esté aplicada, un despliegue que la necesite rompe toda consulta a
-- "Appointment": el cliente de Prisma pide la columna "priceTierId".

DO $$ BEGIN
  CREATE TYPE "PriceLadderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PriceLadder" (
  "id" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "status" "PriceLadderStatus" NOT NULL DEFAULT 'PENDING',
  "adminReviewNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceLadder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceLadderTier" (
  "id" TEXT NOT NULL,
  "ladderId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "seatsTaken" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PriceLadderTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceLadderEnrollment" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "tierId" TEXT,
  "appointmentId" TEXT,
  "price" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceLadderEnrollment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "priceTierId" TEXT;

CREATE INDEX IF NOT EXISTS "PriceLadder_professionalId_serviceId_status_idx" ON "PriceLadder"("professionalId", "serviceId", "status");
CREATE INDEX IF NOT EXISTS "PriceLadder_status_idx" ON "PriceLadder"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceLadderTier_ladderId_position_key" ON "PriceLadderTier"("ladderId", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceLadderEnrollment_patientId_professionalId_serviceId_key" ON "PriceLadderEnrollment"("patientId", "professionalId", "serviceId");
CREATE INDEX IF NOT EXISTS "PriceLadderEnrollment_tierId_idx" ON "PriceLadderEnrollment"("tierId");
CREATE INDEX IF NOT EXISTS "Appointment_priceTierId_idx" ON "Appointment"("priceTierId");

-- Una sola escalera aprobada por consulta. Índice parcial: Prisma no sabe
-- expresarlo, así que va a aparecer en `migrate diff` como si fuera drift. No lo es.
CREATE UNIQUE INDEX IF NOT EXISTS "PriceLadder_una_aprobada_por_consulta"
  ON "PriceLadder"("professionalId", "serviceId")
  WHERE "status" = 'APPROVED';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceLadder_professionalId_serviceId_fkey') THEN
    ALTER TABLE "PriceLadder" ADD CONSTRAINT "PriceLadder_professionalId_serviceId_fkey"
      FOREIGN KEY ("professionalId", "serviceId") REFERENCES "ServiceAssignment"("professionalId", "serviceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceLadderTier_ladderId_fkey') THEN
    ALTER TABLE "PriceLadderTier" ADD CONSTRAINT "PriceLadderTier_ladderId_fkey"
      FOREIGN KEY ("ladderId") REFERENCES "PriceLadder"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceLadderEnrollment_patientId_fkey') THEN
    ALTER TABLE "PriceLadderEnrollment" ADD CONSTRAINT "PriceLadderEnrollment_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceLadderEnrollment_tierId_fkey') THEN
    ALTER TABLE "PriceLadderEnrollment" ADD CONSTRAINT "PriceLadderEnrollment_tierId_fkey"
      FOREIGN KEY ("tierId") REFERENCES "PriceLadderTier"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_priceTierId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_priceTierId_fkey"
      FOREIGN KEY ("priceTierId") REFERENCES "PriceLadderTier"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
