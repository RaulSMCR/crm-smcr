-- Slug legible para los servicios.
--
-- Hasta ahora la URL pública era /servicios/{cuid}: opaca para una persona y sin
-- ninguna señal de tema para un buscador. Las URLs con cuid quedan registradas
-- en SlugRedirect por scripts/migrate-service-slugs.mjs, así que siguen
-- funcionando con un 308.
--
-- Se agrega nullable a propósito: el valor lo escribe el script de migración, y
-- recién después se pone NOT NULL (ver 20260820020000_service_slug_required).
-- Hacerlo en un solo paso exigiría transliterar acentos en SQL, que depende de
-- la extensión unaccent y no está garantizada.

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_key" ON "Service"("slug");
