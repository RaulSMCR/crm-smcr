// src/lib/acuerdo-server.js
// El acuerdo, del lado del servidor.
//
// Vive aparte de lib/acuerdo porque ese módulo lo importa el formulario de
// registro, que es un componente cliente: meterle Prisma lo arrastraría al
// bundle del navegador.
//
// Acá está el candado real. La casilla del formulario y el botón deshabilitado
// son cortesía visual; lo que efectivamente impide reservar con un repaso
// pendiente es esto.

import { prisma } from "@/lib/prisma";
import {
  CONTEXTOS,
  ERROR_ACUERDO_PENDIENTE,
  SELECT_ACUERDO,
  VERSION_ACUERDO,
  necesitaReleerAcuerdo,
} from "@/lib/acuerdo";

/**
 * ¿Puede esta persona reservar, o tiene un repaso pendiente?
 *
 * Solo bloquea el repaso explícito (`acuerdoPendienteDesde`), no la versión
 * desactualizada: a quien se registró antes de que el acuerdo existiera se le
 * pide aceptar desde el panel, sin dejarlo tirado a mitad de una reserva.
 *
 * @returns {Promise<null | {error: string, errorCode: string}>} null si puede seguir.
 */
export async function bloqueoPorAcuerdoPendiente(userId) {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: SELECT_ACUERDO,
  });

  if (!user || !necesitaReleerAcuerdo(user)) return null;

  return {
    error:
      "Antes de reservar de nuevo te pedimos repasar el acuerdo de atención. Son dos minutos.",
    errorCode: ERROR_ACUERDO_PENDIENTE,
  };
}

/**
 * Marca que a esta persona le toca releer el acuerdo.
 *
 * Se llama desde la aplicación de la política. Es un candado distinto del de la
 * agenda: el administrador puede devolverle el acceso y el repaso sigue
 * pendiente, porque son dos cosas distintas —el permiso y la comprensión— y se
 * resuelven por separado.
 */
export function marcarRepasoPendiente(contexto) {
  return {
    acuerdoPendienteDesde: new Date(),
    acuerdoPendienteMotivo: contexto,
  };
}

/**
 * Deja constancia de que se le recordaron las reglas al reservar la segunda
 * cita con un profesional.
 *
 * Lo decide el servidor recontando las citas previas, no el cliente: si la
 * casilla del formulario fuera la fuente de verdad, bastaría un fetch a mano
 * para tener un registro de consentimiento que nadie leyó.
 *
 * Nunca lanza: si esto falla, la cita igual tiene que quedar reservada.
 */
export async function anotarRecordatorioSegundaCita(userId, citasPrevias) {
  if (citasPrevias !== 1) return;

  try {
    await prisma.aceptacionAcuerdo.create({
      data: {
        userId: String(userId),
        version: VERSION_ACUERDO,
        contexto: CONTEXTOS.SEGUNDA_CITA,
      },
    });
  } catch (error) {
    console.error("anotarRecordatorioSegundaCita error:", error);
  }
}
