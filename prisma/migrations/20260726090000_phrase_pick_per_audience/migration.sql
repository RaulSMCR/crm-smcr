-- Cada una de las 8 audiencias necesita su propia elección el mismo día.
-- La tabla se creó con "date" como clave única, lo que hacía que elegir la
-- frase de una audiencia sobrescribiera silenciosamente la de las demás.
-- Se corrige a (date, audience) mientras la tabla está recién creada y con
-- una sola fila real en producción.

-- DropIndex
DROP INDEX "DailyPhrasePick_date_key";

-- AlterTable: la única fila existente ya trae audience = 'MR26', así que el
-- NOT NULL es seguro sin backfill.
ALTER TABLE "DailyPhrasePick" ALTER COLUMN "audience" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DailyPhrasePick_date_audience_key" ON "DailyPhrasePick"("date", "audience");
