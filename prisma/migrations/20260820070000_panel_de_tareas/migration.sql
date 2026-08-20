-- Panel de tareas sostenidas (S16).
--
-- El inventario diario que ya existía guardaba lo hecho en `localStorage`: por
-- navegador, perdido al cambiar de máquina, y sin forma de calcular una racha.
-- Estas tablas lo mueven a la base, que es lo que permite que "¿escribí ayer?"
-- tenga respuesta.

CREATE TABLE IF NOT EXISTS "TaskLog" (
    "id"         TEXT NOT NULL,
    "fecha"      DATE NOT NULL,
    "cadencia"   VARCHAR(12) NOT NULL,
    "clave"      VARCHAR(60) NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "nota"       TEXT,
    "datos"      JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TaskLog_cadencia_check" CHECK ("cadencia" IN ('diaria','semanal','mensual','trimestral'))
);

-- Una tarea por día: marcar dos veces la misma actualiza, no duplica.
CREATE UNIQUE INDEX IF NOT EXISTS "TaskLog_fecha_clave_key" ON "TaskLog"("fecha", "clave");
CREATE INDEX IF NOT EXISTS "TaskLog_fecha_idx" ON "TaskLog"("fecha" DESC);
CREATE INDEX IF NOT EXISTS "TaskLog_clave_fecha_idx" ON "TaskLog"("clave", "fecha" DESC);

-- Contactos para menciones externas. Las menciones de marca fuera del dominio
-- propio son lo que más correlaciona con visibilidad en IA, y es la tarea que
-- menos se siente como trabajo: sin registro, no se sostiene.
CREATE TABLE IF NOT EXISTS "OutreachLog" (
    "id"           TEXT NOT NULL,
    "fecha"        DATE NOT NULL,
    "destinatario" VARCHAR(200) NOT NULL,
    "canal"        VARCHAR(40),
    "pedido"       TEXT,
    "resultado"    VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "urlMencion"   TEXT,
    "seguimiento"  DATE,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OutreachLog_resultado_check" CHECK ("resultado" IN ('pendiente','respondio','publicado','sin_respuesta'))
);

CREATE INDEX IF NOT EXISTS "OutreachLog_fecha_idx" ON "OutreachLog"("fecha" DESC);
-- Índice parcial: solo interesa buscar seguimientos de lo que sigue pendiente.
CREATE INDEX IF NOT EXISTS "OutreachLog_seguimiento_idx"
    ON "OutreachLog"("seguimiento") WHERE "resultado" = 'pendiente';

-- Campos del pipeline editorial, en Post.
--
-- `extractiveBlock` es campo propio y no reusa `metaDescription` (D12): son dos
-- textos con trabajos distintos. La meta description compite por el clic en una
-- lista y se corta a 160; el bloque extractivo responde una pregunta completa
-- para que un modelo pueda citarlo sin recortarlo. En un solo campo, uno de los
-- dos sale mal.
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "extractiveBlock"      TEXT,
  ADD COLUMN IF NOT EXISTS "videoUrl"             TEXT,
  ADD COLUMN IF NOT EXISTS "transcriptUploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slidesDoneAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reelsDoneAt"          TIMESTAMP(3);
