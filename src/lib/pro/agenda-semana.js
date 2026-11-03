// src/lib/pro/agenda-semana.js
//
// La vista «Semana» de la app de profesionales: siete días seguidos desde el
// que se pida, con todos los días a la vista aunque estén libres —un día vacío
// también es información cuando hay que ofrecerle un horario a alguien—.
//
// Puro: recibe `ahora` y el parámetro de la URL, y devuelve fechas tico
// 'YYYY-MM-DD'. Las fechas en ese formato se comparan bien como texto.

import { crAddDays, crDay, DIAS_HACIA_ADELANTE, instanteDeHoraCR } from "@/lib/appointment-slots";

export const DIAS_POR_SEMANA = 7;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string|undefined} desdeParam  ?desde=YYYY-MM-DD, o nada para hoy
 * @param {Date} [ahora]
 */
export function semanaDesde(desdeParam, ahora = new Date()) {
  const hoy = crDay(ahora);
  const ultimoInicio = crAddDays(hoy, DIAS_HACIA_ADELANTE - DIAS_POR_SEMANA);

  let desde = FECHA.test(String(desdeParam || "")) ? String(desdeParam) : hoy;
  if (desde < hoy) desde = hoy;
  if (desde > ultimoInicio) desde = ultimoInicio;

  const dias = Array.from({ length: DIAS_POR_SEMANA }, (_, i) => crAddDays(desde, i));
  const anterior = desde > hoy ? [crAddDays(desde, -DIAS_POR_SEMANA), hoy].sort()[1] : null;
  const siguiente = desde < ultimoInicio ? [crAddDays(desde, DIAS_POR_SEMANA), ultimoInicio].sort()[0] : null;

  return {
    desde,
    dias,
    inicio: instanteDeHoraCR(desde, "00:00"),
    fin: instanteDeHoraCR(crAddDays(desde, DIAS_POR_SEMANA), "00:00"),
    anterior,
    siguiente,
  };
}

/** Las citas repartidas en cada uno de los días, en orden de hora. */
export function agruparPorDia(citas, dias) {
  const porDia = new Map(dias.map((dia) => [dia, []]));
  for (const cita of [...citas].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    porDia.get(crDay(new Date(cita.date)))?.push(cita);
  }
  return dias.map((dia) => ({ dia, citas: porDia.get(dia) }));
}
