-- El caso es un registro ADMINISTRATIVO, no un expediente clínico.
--
-- Corrección de la migración anterior (20260816090000). El expediente le
-- pertenece a la persona y a su profesional, y conservarlo diez años es
-- obligación del profesional colegiado (CPPCR, arts. 21 y 22), no de la
-- plataforma. La plataforma se ocupa de la parte administrativa: cuándo empezó
-- un proceso, cuándo terminó y bajo qué categoría.
--
-- Con quién y cada cuánto supervisa su práctica lo decide cada profesional. El
-- visado de las altas y bajas es un control del negocio —protege a la empresa y
-- al profesional de un cierre mal documentado—, no supervisión clínica.
--
-- Se eliminan las columnas de relato clínico, que nunca debieron existir acá.
-- Estaban vacías: la tabla se creó con 0 filas y no llegó a usarse, así que no
-- se pierde ningún dato.

-- Relato clínico: fuera. Esto es expediente y el expediente no vive acá.
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "cierreEvolucion";
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "cierreEstadoActual";
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "cierreRecomendaciones";
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "cierreReferencia";

-- El motivo de consulta es dato de salud (Ley 8968, art. 3.c). Se eliminó antes
-- de llegar a poblarse: si el día de mañana se necesita, que sea una decisión
-- consciente y no un campo que quedó abierto.
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "motivoConsulta";

-- El cierre se declara con atestaciones, no con relato.
ALTER TABLE "Caso" ADD COLUMN "personaInformada"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Caso" ADD COLUMN "registradoEnExpediente" BOOLEAN NOT NULL DEFAULT false;

-- Solo el destino de la derivación. Las indicaciones son del expediente.
ALTER TABLE "Caso" ADD COLUMN "derivadoA" VARCHAR(200);
