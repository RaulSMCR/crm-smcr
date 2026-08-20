-- Fecha de la última edición REAL del artículo.
--
-- `updatedAt` no sirve para eso y no es un matiz: el contador de vistas hace
-- `prisma.post.update` en cada visita, así que `updatedAt` se mueve cada vez que
-- alguien abre el artículo. El `dateModified` del JSON-LD venía de ahí, o sea que
-- le decíamos a Google que cada artículo se edita varias veces por día.
--
-- Queda nullable a propósito: para los quince artículos que ya existen no hay
-- forma de saber cuándo se editaron por última vez, y `updatedAt` está
-- contaminado. Nulo significa "no sabemos", y el código cae a `createdAt` en vez
-- de inventar una fecha.

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "contentUpdatedAt" TIMESTAMP(3);
