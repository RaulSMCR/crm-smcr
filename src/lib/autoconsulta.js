// src/lib/autoconsulta.js
//
// Nadie se atiende a sí mismo.
//
// Un profesional con la sesión abierta entra a la agenda pública como cualquier
// otra persona, y ahí no había nada mirando quién era: el 2026-09-11 quedó
// reservada una consulta de un profesional consigo mismo desde su propio perfil.
// Las otras dos rutas de agendado lo impedían de rebote —el panel del paciente
// exige rol USER y el de la agenda exige que el paciente lo tenga— pero una
// protección que existe por casualidad no es una protección: ninguna de las dos
// se escribió para esto y cualquiera de las dos puede relajarse mañana sin que
// nadie note lo que se llevó puesto.
//
// No es higiene de datos. La cita congela precio, dispara el adelanto del 50% y
// termina en una factura electrónica con receptor: una consulta de alguien
// consigo mismo se cobra y se declara ante Hacienda como una prestación que no
// ocurrió. Y antes que eso está lo obvio, que es clínico y no informático: no
// hay encuadre posible donde las dos sillas las ocupa la misma persona.

import { prisma } from "@/lib/prisma";

export const ERROR_AUTOCONSULTA = "AUTOCONSULTA";

/**
 * ¿Está esta persona reservando consigo misma?
 *
 * El perfil profesional y el usuario son dos filas distintas, así que la
 * comparación no es entre los dos identificadores que llegan: hay que resolver
 * de qué usuario cuelga el perfil elegido.
 *
 * A diferencia de los otros candados de la reserva, este no falla abierto. Si la
 * base no responde, la reserva se cae por su cuenta unas líneas más abajo; dejar
 * pasar la cita ante la duda es justamente lo que se está corrigiendo.
 *
 * @param {string} patientId       usuario que reserva
 * @param {string} professionalId  perfil profesional elegido, no su usuario
 * @returns {Promise<{error: string, errorCode: string}|null>}
 */
export async function bloqueoPorAutoconsulta(patientId, professionalId) {
  const perfil = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId) },
    select: { userId: true },
  });

  if (!perfil?.userId || perfil.userId !== String(patientId)) return null;

  return {
    error:
      "No podés agendar una consulta con vos mismo. Si buscás atención, " +
      "elegí a otra persona del equipo.",
    errorCode: ERROR_AUTOCONSULTA,
  };
}
