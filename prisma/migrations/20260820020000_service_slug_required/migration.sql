-- El slug de servicio pasa a obligatorio.
--
-- Va en una migración aparte de la que creó la columna porque en el medio
-- corre scripts/migrate-service-slugs.mjs, que es quien escribe los valores.
-- Transliterar acentos en SQL habría exigido la extensión unaccent, que no está
-- garantizada en el proyecto.

ALTER TABLE "Service" ALTER COLUMN "slug" SET NOT NULL;
