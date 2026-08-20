-- Historial de slugs: qué URL vieja lleva a cuál actual.
-- Ver docs/planes/S2-plan.md §1 para por qué es una tabla y no un campo
-- slugHistory[] por entidad.

CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- Un slug viejo no puede apuntar a dos destinos.
CREATE UNIQUE INDEX "SlugRedirect_entityType_fromSlug_key"
    ON "SlugRedirect"("entityType", "fromSlug");

-- Para encadenar saltos y para el --revert de S4.
CREATE INDEX "SlugRedirect_entityType_toSlug_idx"
    ON "SlugRedirect"("entityType", "toSlug");
