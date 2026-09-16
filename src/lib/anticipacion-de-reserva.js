// src/lib/anticipacion-de-reserva.js
//
// Con cuánta anticipación puede un paciente reservar por su cuenta.
//
// Hasta acá, cualquier cupo futuro se ofrecía: un paciente podía reservar a las
// once y media de la noche una cita para las siete de la mañana siguiente. El
// profesional se enteraba al despertar —si despertaba a tiempo—, y quien no
// llega a su propia consulta no tiene forma de repararlo.
//
// La regla, decidida por Raúl el 2026-09-15, son tres frases que se resuelven
// en un solo instante:
//
//   1. el mismo día no se agenda;
//   2. el día siguiente, no antes de las 9:00 de la mañana tica;
//   3. y nunca con menos de 12 horas de aviso.
//
// Las tres juntas dicen lo mismo que «el cupo más temprano reservable es el
// mayor entre *mañana a las 9* y *dentro de 12 horas*», y por eso todo esto es
// una sola fecha —el piso— que se compara con el inicio del cupo. Un número y
// no una cadena de condiciones repartidas por seis pantallas.
//
// Vale para lo que el paciente reserva o mueve solo. Lo que agenda el
// profesional —una cita creada desde su panel, un seguimiento, una
// reprogramación suya— no pasa por acá: ahí hay alguien despierto decidiendo,
// que es justo lo que esta regla protege.

import { CR_TZ, crAddDays, crDay, formatSelectedLabel, instanteDeHoraCR } from "@/lib/appointment-slots";

/** Desde qué hora tica se puede agendar para el día siguiente. */
export const HORA_MINIMA_DIA_SIGUIENTE = "09:00";

/** Aviso mínimo, en horas, para cualquier cita. */
export const AVISO_MINIMO_HORAS = 12;

const MS_POR_HORA = 3600000;

/**
 * El cupo más temprano que un paciente puede reservar.
 *
 * @param {Date} [ahora]
 * @returns {Date}
 */
export function primerInstanteReservable(ahora = new Date()) {
  const porAviso = new Date(ahora.getTime() + AVISO_MINIMO_HORAS * MS_POR_HORA);
  // «Mañana» es el día del calendario tico, que es el del profesional: a las
  // 23:00 de Costa Rica un paciente en Madrid ya tiene otra fecha en su reloj,
  // y la cita ocurre en la agenda de acá.
  const porElDia = instanteDeHoraCR(crAddDays(crDay(ahora), 1), HORA_MINIMA_DIA_SIGUIENTE);
  return porAviso.getTime() > porElDia.getTime() ? porAviso : porElDia;
}

/**
 * ¿Es demasiado pronto? Devuelve el motivo para mostrar, o `null` si se puede.
 *
 * El mensaje dice el porqué y la salida —desde cuándo sí—, porque un «no se
 * puede» sin fecha deja a la persona probando cupos a ver cuál entra.
 *
 * @param {Date|string} inicio  cuándo empieza la cita
 * @param {Date} [ahora]
 * @returns {string|null}
 */
export function motivoDeAnticipacion(inicio, ahora = new Date()) {
  const cuando = inicio instanceof Date ? inicio : new Date(inicio);
  if (Number.isNaN(cuando.getTime())) return "Ese horario no es válido.";

  const piso = primerInstanteReservable(ahora);
  if (cuando.getTime() >= piso.getTime()) return null;

  return (
    `Ese horario es demasiado pronto: las citas se agendan con al menos ${AVISO_MINIMO_HORAS} horas ` +
    `de anticipación, y no para el mismo día ni antes de las ${HORA_MINIMA_DIA_SIGUIENTE} del día ` +
    `siguiente. El horario más cercano que podés reservar empieza el ${formatSelectedLabel(piso, CR_TZ)}.`
  );
}

/** La misma regla dicha en corto, para explicarla antes de que estorbe. */
export function textoDeAnticipacion() {
  return (
    `Las citas se agendan con al menos ${AVISO_MINIMO_HORAS} horas de anticipación: no para hoy, ` +
    `ni antes de las ${HORA_MINIMA_DIA_SIGUIENTE} de mañana.`
  );
}
