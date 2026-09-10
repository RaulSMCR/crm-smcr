-- Calendario de trabajo del profesional.
--
-- La app escribía y leía siempre en "primary". Cuando el profesional se rige
-- por otro calendario de su cuenta, eso hacía dos cosas mal a la vez: publicaba
-- las citas donde él no mira, y no veía lo que tenía ocupado donde sí trabaja.
--
-- NULL conserva el comportamiento anterior ("primary"), así que nadie cambia de
-- conducta hasta que elige.

ALTER TABLE "ProfessionalProfile"
    ADD COLUMN "googleCalendarId" TEXT,
    ADD COLUMN "googleBusyCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
