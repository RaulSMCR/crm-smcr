// src/lib/rates.js
// Resolución de la tarifa que rige una cita: servicio + lugar + franja horaria.
//
// Un profesional carga UNA tarifa si cobra siempre lo mismo, y agrega filas solo
// donde el precio difiere (a domicilio, o en la franja vespertina). Para eso las
// tarifas admiten `locationId`/`timeBandId` en NULL con el sentido de "cualquiera",
// y acá se elige la más específica que aplique.
//
// Funciones puras: no tocan la base ni el entorno.

/** Orden de especificidad: gana la primera que exista. */
export const RATE_MATCH_ORDER = [
  { location: true, band: true }, // este lugar, esta franja
  { location: true, band: false }, // este lugar, cualquier franja
  { location: false, band: true }, // cualquier lugar, esta franja
  { location: false, band: false }, // catch-all
];

export function parseHHMM(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesOfDay(date, timeZone = "America/Costa_Rica") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  // Intl puede devolver "24" a medianoche según el entorno.
  return (hour % 24) * 60 + minute;
}

/** Día de la semana (0=domingo) en la zona indicada, no en la del servidor. */
export function dayOfWeekInZone(date, timeZone = "America/Costa_Rica") {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  return index === -1 ? null : index;
}

/**
 * Franja que cubre una hora dada. El inicio es inclusivo y el fin exclusivo, de
 * modo que 13:00 pertenece a "Vespertino 13:00-19:00" y no a "Matutino 07:00-13:00".
 *
 * @param {Array<{id:string,name:string,startTime:string,endTime:string}>} bands
 * @param {number|null} minutes – minutos desde medianoche
 */
export function resolveTimeBand(bands, minutes) {
  if (!Array.isArray(bands) || minutes === null || !Number.isFinite(minutes)) return null;

  for (const band of bands) {
    const start = parseHHMM(band?.startTime);
    const end = parseHHMM(band?.endTime);
    if (start === null || end === null) continue;

    // Una franja que cruza la medianoche (22:00-02:00) cubre dos tramos.
    const covers = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;

    if (covers) return band;
  }

  return null;
}

/**
 * Elige la tarifa aplicable entre las del profesional para ese servicio.
 * Solo considera tarifas aprobadas: una propuesta pendiente no puede cobrarse.
 *
 * @param {Array<object>} rates      – tarifas del par (profesional, servicio)
 * @param {{ locationId?: string|null, timeBandId?: string|null }} scope
 * @returns {object|null}
 */
export function resolveRate(rates, { locationId = null, timeBandId = null } = {}) {
  const approved = (Array.isArray(rates) ? rates : []).filter(
    (rate) => rate?.status === "APPROVED" && Number(rate?.approvedPrice) > 0
  );
  if (approved.length === 0) return null;

  for (const { location, band } of RATE_MATCH_ORDER) {
    if (location && !locationId) continue;
    if (band && !timeBandId) continue;

    const found = approved.find(
      (rate) =>
        (location ? rate.locationId === locationId : rate.locationId === null) &&
        (band ? rate.timeBandId === timeBandId : rate.timeBandId === null)
    );
    if (found) return found;
  }

  return null;
}

/**
 * Resuelve precio y trazabilidad para una cita concreta.
 *
 * @returns {{ rate: object|null, price: number|null, timeBand: object|null }}
 */
export function resolveAppointmentRate({ rates, timeBands, locationId, startsAt, timeZone }) {
  const timeBand = resolveTimeBand(timeBands, minutesOfDay(startsAt, timeZone));
  const rate = resolveRate(rates, { locationId, timeBandId: timeBand?.id ?? null });

  return {
    rate,
    timeBand,
    price: rate ? Number(rate.approvedPrice) : null,
  };
}

/**
 * Franjas que se pisan entre sí. El profesional define las suyas libremente, así
 * que hay que impedir que 07:00-13:00 y 12:00-18:00 convivan: la tarifa de una
 * cita a las 12:30 dependería del orden de las filas.
 *
 * @returns {Array<[object, object]>} pares solapados
 */
export function findTimeBandOverlaps(bands) {
  const list = (Array.isArray(bands) ? bands : [])
    .map((band) => ({ band, start: parseHHMM(band?.startTime), end: parseHHMM(band?.endTime) }))
    .filter((item) => item.start !== null && item.end !== null);

  // Una franja que cruza medianoche se parte en dos tramos comparables.
  const segmentsOf = ({ start, end }) =>
    start <= end ? [[start, end]] : [[start, 24 * 60], [0, end]];

  const overlaps = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const collide = segmentsOf(list[i]).some(([aStart, aEnd]) =>
        segmentsOf(list[j]).some(([bStart, bEnd]) => aStart < bEnd && aEnd > bStart)
      );
      if (collide) overlaps.push([list[i].band, list[j].band]);
    }
  }
  return overlaps;
}

/** Rótulo de la modalidad para mostrar al paciente. */
export function modalityLabel(modality) {
  if (modality === "OFFICE") return "Presencial";
  if (modality === "HOME") return "A domicilio";
  if (modality === "VIRTUAL") return "Virtual";
  return "";
}

/** Copia congelada del lugar que se guarda en la cita. */
export function snapshotLocation(location) {
  if (!location) {
    return {
      locationId: null,
      modality: null,
      locationName: null,
      locationAddress: null,
      locationNotes: null,
    };
  }
  // Virtual no lleva ni dirección ni señas: las instrucciones de un lugar
  // virtual son el enlace de la sala, y ese no se le adelanta al paciente —se lo
  // hace llegar el profesional antes de la cita.
  const esVirtual = location.modality === "VIRTUAL";
  return {
    locationId: location.id,
    modality: location.modality,
    locationName: location.name,
    locationAddress: location.modality === "HOME" ? null : location.address || null,
    locationNotes: esVirtual ? null : location.instructions || null,
  };
}
