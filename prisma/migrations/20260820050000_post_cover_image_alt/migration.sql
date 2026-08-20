-- Texto alternativo de la portada del artículo.
--
-- Hasta ahora el `alt` salía de `coverImageTitle`, que es el TÍTULO DE LA OBRA
-- para la línea de crédito —"Las Meninas"—, no una descripción de lo que se ve.
-- Para quien usa lector de pantalla, eso no describe nada; y como señal para un
-- buscador, tampoco.
--
-- Nullable: cuando no hay texto propio se cae al título del artículo, que es
-- impreciso pero no falso.

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "coverImageAlt" VARCHAR(300);
