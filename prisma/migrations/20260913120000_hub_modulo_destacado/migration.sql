-- Una tarjeta destacada por hub profesional.
--
-- El orden de las tarjetas ya se podía cambiar con la columna `position`, pero
-- orden y destaque no son lo mismo: el orden dice qué se lee antes, el destaque
-- dice qué se ve antes de leer. Con solo `position`, poner una pieza al frente
-- obligaba a renumerar el resto y no cambiaba nada del tamaño de la tarjeta.
--
-- La regla «una sola por hub» va en un índice parcial y no en la pantalla: el
-- panel es un escritor, la ingesta de `.md` es otro, y una regla que vive en un
-- componente la incumple el segundo escritor que aparezca.
--
-- Aditiva e idempotente. Aplicar con `prisma migrate deploy`, o con el SQL Editor
-- de Supabase; nunca con migrate dev ni migrate reset.

ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- `WHERE "isFeatured"` es lo que permite que muchos módulos tengan `false` y solo
-- uno `true` por hub. Un índice único común sobre ("hubId", "isFeatured") dejaría
-- un único módulo no destacado por hub, que es exactamente lo contrario.
CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalHubModule_una_destacada_por_hub"
    ON "ProfessionalHubModule" ("hubId")
 WHERE "isFeatured";
