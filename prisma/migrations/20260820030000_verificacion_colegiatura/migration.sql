-- Verificación de colegiatura.
--
-- Hasta ahora `licenseNumber` era una cadena suelta: un número sin autoridad que
-- lo respalde, sin fecha, y sin forma de que nadie —ni una persona ni un
-- buscador— comprobara que existe. En categoría YMYL eso es una afirmación sin
-- respaldo.
--
-- El procedimiento que estos campos registran es el que ya se hace: antes de
-- entrevistar a alguien, el admin revisa su matrícula en el colegio profesional
-- correspondiente y guarda el enlace al punto del registro público donde
-- aparece. Esto lo deja asentado en vez de que viva en la memoria de quien miró.

ALTER TABLE "ProfessionalProfile"
  ADD COLUMN IF NOT EXISTS "licensingBody"          VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "licenseVerifiedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "licenseVerificationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "licenseVerifiedById"    TEXT;

-- Quién verificó. RESTRICT y no CASCADE: si se borrara el usuario admin que
-- verificó, perder el registro de la verificación sería perder la evidencia.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfessionalProfile_licenseVerifiedById_fkey') THEN
    ALTER TABLE "ProfessionalProfile"
      ADD CONSTRAINT "ProfessionalProfile_licenseVerifiedById_fkey"
      FOREIGN KEY ("licenseVerifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProfessionalProfile_licenseVerifiedAt_idx"
  ON "ProfessionalProfile"("licenseVerifiedAt");
