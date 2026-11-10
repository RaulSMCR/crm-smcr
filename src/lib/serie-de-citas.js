// src/lib/serie-de-citas.js
//
// Citas recurrentes comunes (no de un acuerdo de atención) como UNA serie.
//
// Antes, agendar doce lunes publicaba doce eventos sueltos en Google —doce
// invitaciones— y mandaba doce correos de «Cita agendada» a cada uno. Ahora las
// citas que nacieron juntas se publican como un solo evento recurrente, y cada
// cita apunta a su instancia (`<maestro>_<inicio UTC>`, igual que los acuerdos),
// así que moverla o cancelarla sigue tocando solo esa fecha.
//
// Puro: sin base ni red, para poder probarlo.

import { fechaRfc5545, idDeSesionEnGoogle } from "@/lib/acuerdos-de-atencion";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Regla RFC 5545 que reproduce exactamente las fechas dadas, o null si no la
 * hay: hacen falta dos o más citas, a intervalos iguales de semanas enteras y
 * con la misma duración. Si no se cumple, se publican sueltas: una serie que no
 * coincide con las citas dejaría instancias fantasma en Google.
 */
export function reglaDeSerie(citas = []) {
  if (citas.length < 2) return null;
  const ordenadas = [...citas].sort((a, b) => new Date(a.date) - new Date(b.date));
  const paso = new Date(ordenadas[1].date) - new Date(ordenadas[0].date);
  if (paso <= 0 || paso % SEMANA_MS !== 0) return null;
  const duracion = new Date(ordenadas[0].endDate) - new Date(ordenadas[0].date);

  for (let i = 1; i < ordenadas.length; i += 1) {
    const actual = ordenadas[i];
    if (new Date(actual.date) - new Date(ordenadas[i - 1].date) !== paso) return null;
    if (new Date(actual.endDate) - new Date(actual.date) !== duracion) return null;
  }

  const intervalo = paso / SEMANA_MS;
  const partes = ["FREQ=WEEKLY", ...(intervalo > 1 ? [`INTERVAL=${intervalo}`] : []), `COUNT=${ordenadas.length}`];
  return { rrule: `RRULE:${partes.join(";")}`, intervaloSemanas: intervalo, total: ordenadas.length };
}

/**
 * Reparte las citas que todavía no están en Google: las que se crearon en la
 * misma operación (mismo paciente, profesional y `createdAt`) y siguen una
 * regla forman una serie; el resto va suelto.
 *
 * `createdAt` idéntico es la marca de «nacieron juntas»: las crea una sola
 * transacción. Sirve también al reconectar Google, cuando ya no se sabe qué
 * pedido las originó.
 */
export function agruparParaGoogle(citas = []) {
  const grupos = new Map();
  for (const cita of citas) {
    const clave = [cita.patientId, cita.professionalId, cita.acuerdoId || "", new Date(cita.createdAt || 0).getTime()].join("|");
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(cita);
  }

  const series = [];
  const sueltas = [];
  for (const grupo of grupos.values()) {
    const regla = grupo.some((c) => c.acuerdoId) ? null : reglaDeSerie(grupo);
    if (regla) {
      series.push({ citas: [...grupo].sort((a, b) => new Date(a.date) - new Date(b.date)), regla });
    } else {
      sueltas.push(...grupo);
    }
  }
  return { series, sueltas };
}

/** ¿El id de Google es el de una instancia dentro de una serie? */
export function esInstanciaDeSerie(gcalEventId) {
  return /_\d{8}T\d{6}Z$/.test(String(gcalEventId || ""));
}

/** Id de la instancia de cada cita dentro de la serie publicada. */
export function idDeInstancia(maestroId, fecha) {
  return idDeSesionEnGoogle(maestroId, fecha);
}

/** «cada semana», «cada 2 semanas»… para el correo. */
export function textoDeFrecuencia(intervaloSemanas) {
  return intervaloSemanas === 1 ? "cada semana" : `cada ${intervaloSemanas} semanas`;
}

export { fechaRfc5545 };
