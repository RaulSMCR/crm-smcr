-- Piloto PALIG: firma estampada desde el panel.
--
-- Raúl firma el formulario emitido con un botón; la firma rota entre varias
-- versiones. Cada trámite guarda cuál se usó y cuándo se firmó.
--
-- Aditiva e idempotente: dos columnas opcionales (repetirla no hace nada). No
-- toca datos.
--
-- Aplicar con `pnpm run migrate` (prisma migrate deploy) ANTES de desplegar: la
-- pantalla /panel/palig ya las lee y sin ellas muestra «pendiente de activación».

ALTER TABLE "InsuranceClaim" ADD COLUMN IF NOT EXISTS "firmaVersion" INTEGER;
ALTER TABLE "InsuranceClaim" ADD COLUMN IF NOT EXISTS "firmadoAt" TIMESTAMP(3);
