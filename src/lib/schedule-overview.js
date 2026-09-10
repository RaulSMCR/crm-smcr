import { crAddDays, crDay, crParts } from "@/lib/appointment-slots";

/**
 * La agenda del profesional vista como bandas por día, para dibujarla.
 *
 * Junta en un solo lugar las cuatro capas que hoy deciden si un rato está libre:
 * la franja declarada, las citas del sistema, los bloqueos manuales y lo que el
 * profesional tenga ocupado en su Google Calendar. Verlas separadas —una en el
 * formulario de horarios, otra en Google— es lo que produce sorpresas.
 *
 * Todo se expresa en minutos desde la medianoche **de Costa Rica**, que es la
 * zona en la que el profesional declara su disponibilidad.
 */

const MINUTOS_POR_DIA = 24 * 60;

/** A partir de acá una banda se considera "todo el día" para encuadrar la grilla. */
const LARGA = 12 * 60;

/** Márgenes de la grilla cuando el profesional todavía no declaró franjas. */
const RANGO_POR_DEFECTO = { inicio: 6 * 60, fin: 22 * 60 };

function parseHHMM(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function diaDeLaSemana(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Parte un intervalo absoluto en tramos por día tico.
 *
 * Hace falta porque un bloqueo de día completo va de medianoche a medianoche, y
 * un evento de Google puede cruzar la noche. Sin partirlos, la banda se dibujaría
 * en el día equivocado o se saldría de la grilla.
 */
function tramosPorDia(startISO, endISO, extra = {}) {
  const inicio = new Date(startISO);
  const fin = new Date(endISO);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio) return [];

  const tramos = [];
  let ymd = crDay(inicio);
  const ymdFin = crDay(new Date(fin.getTime() - 1));

  // Tope defensivo: un evento corrupto con años de duración no debe colgar la vista.
  for (let vuelta = 0; vuelta < 400; vuelta += 1) {
    const desde = ymd === crDay(inicio) ? crParts(inicio).minutes : 0;
    const hasta = ymd === ymdFin ? crParts(fin).minutes || MINUTOS_POR_DIA : MINUTOS_POR_DIA;

    if (hasta > desde) tramos.push({ ymd, startMin: desde, endMin: hasta, ...extra });
    if (ymd === ymdFin) break;
    ymd = crAddDays(ymd, 1);
  }

  return tramos;
}

/**
 * Arma la semana (o el rango) que se va a dibujar.
 *
 * `appointments`, `blocks` y `googleBusy` son intervalos absolutos; `availability`
 * son las franjas semanales declaradas en hora tica.
 */
export function buildScheduleOverview({
  fromYMD,
  days = 7,
  availability = [],
  appointments = [],
  blocks = [],
  googleBusy = [],
  now = new Date(),
}) {
  const ocupados = [
    ...appointments.map((item) =>
      tramosPorDia(item.startISO, item.endISO, { kind: "cita", label: item.label || "Cita" })
    ),
    ...blocks.map((item) =>
      tramosPorDia(item.startISO, item.endISO, { kind: "bloqueo", label: item.label || "Bloqueo" })
    ),
    ...googleBusy.map((item) =>
      tramosPorDia(item.startISO, item.endISO, { kind: "google", label: item.label || "Evento de Google" })
    ),
  ].flat();

  const porDia = new Map();
  for (const tramo of ocupados) {
    const lista = porDia.get(tramo.ymd) || [];
    lista.push(tramo);
    porDia.set(tramo.ymd, lista);
  }

  const hoy = crDay(now);
  const resultado = [];
  let minGrilla = Infinity;
  let maxGrilla = -Infinity;

  for (let offset = 0; offset < days; offset += 1) {
    const ymd = crAddDays(fromYMD, offset);
    const dow = diaDeLaSemana(ymd);

    const available = availability
      .filter((franja) => franja.dayOfWeek === dow)
      .map((franja) => ({ startMin: parseHHMM(franja.startTime), endMin: parseHHMM(franja.endTime) }))
      .filter((franja) => franja.endMin > franja.startMin)
      .sort((a, b) => a.startMin - b.startMin);

    const busy = (porDia.get(ymd) || []).sort((a, b) => a.startMin - b.startMin);

    // Los márgenes salen de la franja declarada y de las bandas cortas. Una
    // banda larga —un bloqueo de día completo, un vuelo nocturno— estiraría la
    // grilla a 24 horas y aplastaría las horas en que realmente se atiende:
    // esas se dibujan igual, recortadas por el alto de la columna, y se leen
    // como lo que son, el día entero ocupado.
    for (const banda of [...available, ...busy.filter((b) => b.endMin - b.startMin < LARGA)]) {
      if (banda.startMin < minGrilla) minGrilla = banda.startMin;
      if (banda.endMin > maxGrilla) maxGrilla = banda.endMin;
    }

    resultado.push({ ymd, dayOfWeek: dow, isToday: ymd === hoy, available, busy });
  }

  // La grilla se ajusta a lo que hay, con media hora de aire, en vez de mostrar
  // 24 filas de las que 18 estarían siempre vacías.
  if (!Number.isFinite(minGrilla) || !Number.isFinite(maxGrilla)) {
    minGrilla = RANGO_POR_DEFECTO.inicio;
    maxGrilla = RANGO_POR_DEFECTO.fin;
  }

  const gridStartMin = Math.max(0, Math.floor((minGrilla - 30) / 60) * 60);
  const gridEndMin = Math.min(MINUTOS_POR_DIA, Math.ceil((maxGrilla + 30) / 60) * 60);

  return {
    days: resultado,
    gridStartMin,
    gridEndMin: gridEndMin > gridStartMin ? gridEndMin : gridStartMin + 60,
  };
}
