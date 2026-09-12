-- Control editorial de SEO para los hubs profesionales y sus módulos.
--
-- Antes, la meta descripción del hub estaba escrita en el código de la página y
-- el título SEO de cada tema vivía dentro de la columna `metadata` (JSON). Lo
-- primero obligaba a desplegar para cambiar una frase; lo segundo dejaba al hub
-- fuera del panel de SEO, que audita con consultas y no puede filtrar ni contar
-- lo que está dentro de un JSON.
--
-- Aditiva e idempotente: solo ADD COLUMN IF NOT EXISTS y un backfill que no pisa
-- valores existentes, para poder reintentarla si una corrida queda a medias.
-- Aplicar con `prisma migrate deploy`; nunca con migrate dev ni migrate reset.

ALTER TABLE "ProfessionalHub" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "ProfessionalHub" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "ProfessionalHub" ADD COLUMN IF NOT EXISTS "ogImage" TEXT;
ALTER TABLE "ProfessionalHub" ADD COLUMN IF NOT EXISTS "focusKeyword" TEXT;
ALTER TABLE "ProfessionalHub" ADD COLUMN IF NOT EXISTS "noindex" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "ogImage" TEXT;
ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "focusKeyword" TEXT;
ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "noindex" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: lo que el admin ya escribió en `metadata` pasa a las columnas.
-- Se usa `->>` y no el operador `?` a propósito: `->>` devuelve NULL si la clave
-- no existe, así que la misma expresión sirve de lectura y de guarda.
UPDATE "ProfessionalHubModule"
   SET "metaTitle" = NULLIF(TRIM("metadata"->>'titulo_seo'), '')
 WHERE "metaTitle" IS NULL
   AND NULLIF(TRIM("metadata"->>'titulo_seo'), '') IS NOT NULL;

UPDATE "ProfessionalHubModule"
   SET "metaDescription" = NULLIF(TRIM("metadata"->>'meta'), '')
 WHERE "metaDescription" IS NULL
   AND NULLIF(TRIM("metadata"->>'meta'), '') IS NOT NULL;
