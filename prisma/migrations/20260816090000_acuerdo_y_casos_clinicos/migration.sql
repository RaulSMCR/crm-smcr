-- Acuerdo de atención, reenganche y expediente de casos.
--
-- Tres cosas que hoy no existen:
--
--   1. Prueba de que la persona aceptó el acuerdo antes de que se le aplicara.
--      Hasta ahora se cobraban multas y se pausaban agendas sin que nadie
--      hubiera aceptado nada (Ley 8968, art. 9: el consentimiento para datos de
--      salud tiene que ser expreso y demostrable).
--   2. Bitácora de los intentos de volver a contactar a quien faltó.
--   3. El caso: cuándo empezó un proceso, cuándo terminó y por qué, con el
--      cierre visado por la dirección clínica y conservado diez años
--      (Código de Ética y Deontológico del CPPCR, arts. 21 y 22).
--
-- Migración aditiva: no borra ni altera nada existente.

-- ---------------------------------------------------------------------------
-- User: acuerdo aceptado, acuerdo pendiente de repaso y dirección clínica
-- ---------------------------------------------------------------------------

ALTER TABLE "User" ADD COLUMN "acuerdoVersion"    VARCHAR(16);
ALTER TABLE "User" ADD COLUMN "acuerdoAceptadoAt" TIMESTAMP(3);

-- Candado distinto del de la agenda: el administrador puede devolver el acceso
-- y la persona igual tiene que releer el acuerdo antes de volver a reservar.
ALTER TABLE "User" ADD COLUMN "acuerdoPendienteDesde"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "acuerdoPendienteMotivo" VARCHAR(32);

-- Lo que habilita a leer una nota clínica no es el puesto sino la colegiatura.
ALTER TABLE "User" ADD COLUMN "clinicalDirectorSince" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "colegiadoNumero"       VARCHAR(32);
ALTER TABLE "User" ADD COLUMN "colegiadoColegio"      VARCHAR(64);

-- ---------------------------------------------------------------------------
-- AceptacionAcuerdo: append-only, una fila por aceptación
-- ---------------------------------------------------------------------------

CREATE TABLE "AceptacionAcuerdo" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "version"   VARCHAR(16)  NOT NULL,
    "contexto"  VARCHAR(32)  NOT NULL,
    "ip"        VARCHAR(64),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceptacionAcuerdo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AceptacionAcuerdo_userId_createdAt_idx" ON "AceptacionAcuerdo"("userId", "createdAt");
CREATE INDEX "AceptacionAcuerdo_contexto_idx"         ON "AceptacionAcuerdo"("contexto");

ALTER TABLE "AceptacionAcuerdo" ADD CONSTRAINT "AceptacionAcuerdo_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ContactoReenganche: quién fue contactado, por dónde y con qué resultado
-- ---------------------------------------------------------------------------

CREATE TABLE "ContactoReenganche" (
    "id"            TEXT         NOT NULL,
    "patientId"     TEXT         NOT NULL,
    "appointmentId" TEXT,
    "canal"         VARCHAR(16)  NOT NULL,
    "automatico"    BOOLEAN      NOT NULL DEFAULT false,
    "intento"       INTEGER      NOT NULL DEFAULT 0,
    "resultado"     VARCHAR(24),
    "nota"          TEXT,
    "registradoPor" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoReenganche_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactoReenganche_patientId_createdAt_idx" ON "ContactoReenganche"("patientId", "createdAt");
CREATE INDEX "ContactoReenganche_appointmentId_idx"       ON "ContactoReenganche"("appointmentId");

ALTER TABLE "ContactoReenganche" ADD CONSTRAINT "ContactoReenganche_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Caso: el proceso de atención, con su cierre visado
-- ---------------------------------------------------------------------------

CREATE TABLE "Caso" (
    "id"             TEXT         NOT NULL,
    "patientId"      TEXT         NOT NULL,
    "professionalId" TEXT         NOT NULL,

    -- Copia congelada: el expediente tiene que seguir siendo legible aunque la
    -- cuenta cambie de nombre o de cédula.
    "pacienteNombre" VARCHAR(120) NOT NULL,
    "pacienteCedula" VARCHAR(32),

    "estado"         VARCHAR(24)  NOT NULL DEFAULT 'ABIERTO',
    "motivoConsulta" TEXT,
    "abiertoAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "resultado"  VARCHAR(8),
    "tipoCierre" VARCHAR(32),

    "cierrePropuestoAt" TIMESTAMP(3),
    "cerradoAt"         TIMESTAMP(3),

    "cierreEvolucion"       TEXT,
    "cierreEstadoActual"    TEXT,
    "cierreRecomendaciones" TEXT,
    "cierreReferencia"      TEXT,

    "visadoPorId" TEXT,
    "visadoAt"    TIMESTAMP(3),
    "visadoNota"  TEXT,

    -- cerradoAt + 10 años. Nada se depura antes de esta fecha.
    "conservarHasta" TIMESTAMP(3),

    -- Un expediente cerrado deja de moverse: retomar abre uno nuevo que apunta
    -- al anterior.
    "casoAnteriorId" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Caso_casoAnteriorId_key"         ON "Caso"("casoAnteriorId");
CREATE INDEX "Caso_professionalId_estado_idx"         ON "Caso"("professionalId", "estado");
CREATE INDEX "Caso_patientId_estado_idx"              ON "Caso"("patientId", "estado");
CREATE INDEX "Caso_estado_idx"                        ON "Caso"("estado");

-- RESTRICT y no CASCADE, al revés que el resto del schema: hay obligación de
-- conservar el expediente diez años después de concluido el servicio, así que
-- borrar una cuenta no puede llevárselo.
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Caso" ADD CONSTRAINT "Caso_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Caso" ADD CONSTRAINT "Caso_visadoPorId_fkey"
    FOREIGN KEY ("visadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Caso" ADD CONSTRAINT "Caso_casoAnteriorId_fkey"
    FOREIGN KEY ("casoAnteriorId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CasoNota: adendas. Una nota visada no se edita, se corrige con otra fila.
-- ---------------------------------------------------------------------------

CREATE TABLE "CasoNota" (
    "id"        TEXT         NOT NULL,
    "casoId"    TEXT         NOT NULL,
    "tipo"      VARCHAR(24)  NOT NULL,
    "texto"     TEXT         NOT NULL,
    "autorId"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoNota_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CasoNota_casoId_createdAt_idx" ON "CasoNota"("casoId", "createdAt");

ALTER TABLE "CasoNota" ADD CONSTRAINT "CasoNota_casoId_fkey"
    FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CasoNota" ADD CONSTRAINT "CasoNota_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CasoEvento: bitácora, incluidos los accesos de la dirección clínica
-- ---------------------------------------------------------------------------

CREATE TABLE "CasoEvento" (
    "id"        TEXT         NOT NULL,
    "casoId"    TEXT         NOT NULL,
    "tipo"      VARCHAR(32)  NOT NULL,
    "detalle"   TEXT,
    "actorId"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoEvento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CasoEvento_casoId_createdAt_idx" ON "CasoEvento"("casoId", "createdAt");
CREATE INDEX "CasoEvento_tipo_idx"             ON "CasoEvento"("tipo");

ALTER TABLE "CasoEvento" ADD CONSTRAINT "CasoEvento_casoId_fkey"
    FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CasoEvento" ADD CONSTRAINT "CasoEvento_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
