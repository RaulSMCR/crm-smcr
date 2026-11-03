// src/lib/pro/agenda-hoy.js
//
// Cómo se reparte la pantalla «Hoy» de la app de profesionales (/pro). Puro, sin
// base ni fechas implícitas, para probarlo solo.
//
// Tres grupos, en el orden en que el profesional los necesita:
//
//   • Por cerrar — confirmadas que ya empezaron y nadie completó ni marcó
//                  ausente. Van primero: en el panel desaparecían justo cuando
//                  había que cerrarlas, y el cobro y la próxima sesión salen de
//                  ahí.
//   • Hoy        — lo que queda del día, pendientes incluidas.
//   • Próximas   — un vistazo a lo que sigue, para no abrir la semana entera.

import { crAddDays, crDay, instanteDeHoraCR } from "@/lib/appointment-slots";

/** Cuántas citas de los días siguientes se asoman debajo de las de hoy. */
export const PROXIMAS_A_MOSTRAR = 5;

/** Hasta dónde hacia atrás se buscan citas sin cerrar. */
export const DIAS_SIN_CERRAR = 30;

/** Las fechas que la página necesita para pedir las citas. */
export function ventanaDeHoy(ahora = new Date()) {
  const hoy = crDay(ahora);
  return {
    hoy,
    desdeSinCerrar: instanteDeHoraCR(crAddDays(hoy, -DIAS_SIN_CERRAR), "00:00"),
    inicioDeManana: instanteDeHoraCR(crAddDays(hoy, 1), "00:00"),
  };
}

/**
 * @param {Array<{date: Date|string, status: string}>} citas  del profesional,
 *   activas (PENDING o CONFIRMED), en cualquier orden
 * @param {Date} [ahora]
 */
export function repartirAgendaDeHoy(citas, ahora = new Date()) {
  const { inicioDeManana } = ventanaDeHoy(ahora);
  const ordenadas = [...citas].sort((a, b) => new Date(a.date) - new Date(b.date));

  const porCerrar = [];
  const hoy = [];
  const proximas = [];

  for (const cita of ordenadas) {
    const inicio = new Date(cita.date).getTime();
    if (cita.status === "CONFIRMED" && inicio <= ahora.getTime()) porCerrar.push(cita);
    else if (inicio < inicioDeManana.getTime()) {
      // Una pendiente que ya pasó no se puede cerrar ni atender: se queda en
      // el panel, donde se acepta o se cancela.
      if (inicio > ahora.getTime()) hoy.push(cita);
    } else if (proximas.length < PROXIMAS_A_MOSTRAR) proximas.push(cita);
  }

  return { porCerrar, hoy, proximas };
}
