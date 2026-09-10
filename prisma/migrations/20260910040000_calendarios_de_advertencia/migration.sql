-- Calendarios que advierten en vez de bloquear: feriados, sobre todo.
--
-- Un feriado no le ocupa la agenda al profesional —puede atender si quiere, y el
-- paciente puede pedir cita— pero predice ausencias. Cerrar el día sería decidir
-- por él; callarlo deja que la ausencia ocurra. Se avisa a las dos partes.
--
-- Va en su propia migración y no anexada a la anterior: aquella ya estaba
-- aplicada, y agregarle sentencias hizo que este ADD COLUMN nunca corriera
-- mientras Prisma la seguía dando por completa.

ALTER TABLE "ProfessionalProfile"
    ADD COLUMN "googleWarnCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
