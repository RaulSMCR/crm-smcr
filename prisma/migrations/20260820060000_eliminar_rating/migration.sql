-- Se elimina `rating` de ProfessionalProfile.
--
-- El campo existía, se consultaba y no se usaba para nada. Nunca tuvo un valor:
-- las tres filas estaban en NULL.
--
-- No se elimina por higiene, sino por decisión: puntuar psicoterapeutas con una
-- estrellita es la lógica del macro-directorio, es dudosa en clínica, y compite
-- en el único eje donde un agregador siempre gana. Un campo que sigue en el
-- schema es una invitación permanente a llenarlo.

ALTER TABLE "ProfessionalProfile" DROP COLUMN IF EXISTS "rating";
