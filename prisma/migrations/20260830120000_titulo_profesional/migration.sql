-- Título profesional (grado académico) del profesional.
--
-- Hacía falta un dato que no estaba en ninguna parte: el tratamiento con el que
-- la persona firma. El detalle de la factura y el rótulo del cobro de ONVO
-- tienen que nombrar a quien atendió —"Lic. Ana Solano"— y hasta ahora solo
-- existía el nombre pelado. Derivarlo de la disciplina o del género del nombre
-- no es opción: un "Dr." donde va "Dra." queda impreso en un comprobante
-- fiscal. Se pregunta y se guarda.
--
-- Guarda el identificador del catálogo (src/lib/grados-academicos.js), no la
-- abreviatura.
--
-- Migración aditiva y nullable: los perfiles que ya existen quedan sin grado y
-- su nombre sale sin tratamiento hasta que lo declaren, que es exactamente lo
-- que corresponde.

-- AlterTable
ALTER TABLE "ProfessionalProfile"
  ADD COLUMN IF NOT EXISTS "academicDegree" VARCHAR(24);
