// src/lib/intencion-de-agenda-servidor.js
//
// El nombre y el servicio que van detrás de una intención de agendar.
//
// Separado de `intencion-de-agenda.js` porque aquello es lógica pura que también
// corre en el navegador, y esto toca la base. Lo usan las dos pantallas por las
// que pasa quien todavía no tiene cuenta —el registro y el ingreso—, y conviene
// que digan exactamente lo mismo.
//
// Los nombres salen de la base y no del enlace. Podrían venir en el `next` y
// ahorrarse la consulta, pero entonces cualquiera podría armar una dirección de
// este sitio que muestre el nombre que quiera encima de un formulario que pide
// identificación y contraseña. Lo que no existe en la base, no se muestra.

import { prisma } from "@/lib/prisma";
import { getManagedHubData } from "@/lib/hub-raul";
import { etiquetaDelHorario, leerIntencion } from "@/lib/intencion-de-agenda";

/**
 * @param {string} next  la ruta de regreso, tal como llegó por la dirección
 * @returns {Promise<{next: string, profesional: string|null, servicio: string|null, horario: string|null}|null>}
 */
export async function resolverIntencionDeAgenda(next) {
  const intencion = leerIntencion(next);
  if (!intencion) return null;

  try {
    const profesional = await prisma.professionalProfile.findUnique({
      where: { id: intencion.professionalId },
      select: { slug: true, user: { select: { name: true } } },
    });
    if (!profesional) return null;

    const servicio = intencion.serviceId
      ? await prisma.service.findUnique({
          where: { id: intencion.serviceId },
          select: { title: true },
        })
      : null;

    // Mismo nombre que muestra la agenda de la que viene: el hub gestionado pisa
    // el nombre de la cuenta, y verlo cambiar de una pantalla a la siguiente es
    // motivo suficiente para dudar de dónde está uno.
    const hub = profesional.slug === "raul-olmedo" ? await getManagedHubData() : null;

    return {
      next: String(next),
      profesional: hub?.nombre || profesional.user?.name || null,
      servicio: servicio?.title || null,
      horario: etiquetaDelHorario(intencion.fecha, intencion.hora),
    };
  } catch {
    // Si la base no responde, registrarse e ingresar tienen que seguir
    // funcionando: lo que se pierde es el recordatorio de la cita, no la puerta.
    return null;
  }
}

export default resolverIntencionDeAgenda;
