/**
 * Generación de horarios ofrecibles.
 *
 * La franja de atención del profesional (`Availability`) está declarada en hora
 * de Costa Rica: "martes de 08:00 a 12:00" significa las ocho de la mañana
 * ticas, sin importar desde dónde se mire.
 *
 * Antes esto se armaba con métodos de fecha locales (`setHours`, `getDay`), y
 * como el cálculo corre en el navegador del paciente, la franja se reinterpretaba
 * en la zona horaria de quien miraba. Un paciente en Oslo veía "09:00" y estaba
 * reservando la una de la madrugada en Costa Rica, un horario que el profesional
 * nunca ofreció. Con pacientes en Europa eso no era una hipótesis.
 *
 * Ahora los cupos se construyen como instantes absolutos anclados a Costa Rica,
 * y cada pantalla decide en qué reloj los muestra.
 */

const CR_TZ = "America/Costa_Rica";

/**
 * Costa Rica no aplica horario de verano, así que el offset es siempre -06:00.
 * El resto del proyecto ya se apoya en eso (ver `lib/fe/signer.js`).
 */
const CR_OFFSET = "-06:00";

const FORMATO_DIA_CR = new Intl.DateTimeFormat("en-CA", {
  timeZone: CR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseHHMM(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map((part) => Number(part));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/** El día calendario de Costa Rica que corresponde a un instante, como 'YYYY-MM-DD'. */
function diaCR(date) {
  return FORMATO_DIA_CR.format(date);
}

/** Suma días a un 'YYYY-MM-DD'. Date.UTC normaliza fin de mes y de año. */
function sumarDias(ymd, cantidad) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + cantidad)).toISOString().slice(0, 10);
}

/**
 * Día de la semana (0=domingo) del día calendario, sin que influya la zona
 * horaria de quien ejecuta: se lee en UTC sobre una fecha construida en UTC.
 */
function diaDeLaSemana(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** El instante absoluto de una hora de pared costarricense. */
function instanteCR(ymd, minutosDesdeMedianoche) {
  const horas = String(Math.floor(minutosDesdeMedianoche / 60)).padStart(2, "0");
  const minutos = String(minutosDesdeMedianoche % 60).padStart(2, "0");
  return new Date(`${ymd}T${horas}:${minutos}:00${CR_OFFSET}`);
}

/**
 * Arma los horarios ofrecibles a partir de la disponibilidad semanal.
 *
 * `booked` son los intervalos ocupados **por cualquier motivo**: citas ya
 * tomadas, bloqueos de agenda del profesional (`ScheduleBlock`) y lo que tenga
 * ocupado en su Google Calendar. Se mezclan a propósito en una sola lista,
 * porque a quien mira los horarios le da lo mismo por qué un rato no está libre,
 * y porque tener un solo canal evita que una pantalla nueva se olvide de alguno.
 *
 * Los días se agrupan por fecha de Costa Rica, que es la del profesional. Cada
 * `day` es el instante de la medianoche tica de ese día.
 *
 * Ojo: esto solo decide qué se *muestra*. La verificación que impide reservar
 * sobre un rato ocupado vive en `@/lib/booking-conflicts` y corre en el servidor
 * al confirmar.
 */
export function buildSlots({ availability = [], durationMin = 60, booked = [], daysAhead = 14, now = new Date() }) {
  const bookedIntervals = booked.map((item) => ({
    start: new Date(item.startISO).getTime(),
    end: new Date(item.endISO).getTime(),
  }));

  const byDayOfWeek = new Map();
  for (const block of availability) {
    const list = byDayOfWeek.get(block.dayOfWeek) || [];
    list.push(block);
    byDayOfWeek.set(block.dayOfWeek, list);
  }

  const days = [];
  const hoy = diaCR(now);
  const ahora = now.getTime();

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const ymd = sumarDias(hoy, offset);
    const windows = byDayOfWeek.get(diaDeLaSemana(ymd)) || [];
    const slots = [];

    for (const window of windows) {
      const startMin = parseHHMM(window.startTime);
      const endMin = parseHHMM(window.endTime);

      for (let minutes = startMin; minutes + durationMin <= endMin; minutes += durationMin) {
        const start = instanteCR(ymd, minutes);
        const end = new Date(start.getTime() + durationMin * 60000);

        const startMs = start.getTime();
        if (startMs <= ahora) continue;

        const isTaken = bookedIntervals.some((interval) =>
          overlaps(startMs, end.getTime(), interval.start, interval.end)
        );

        if (!isTaken) slots.push({ start, end });
      }
    }

    if (slots.length > 0) days.push({ day: instanteCR(ymd, 0), slots });
  }

  return days;
}

/** La zona horaria del navegador o del servidor que ejecuta. */
export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || CR_TZ;
  } catch {
    return CR_TZ;
  }
}

/**
 * Etiqueta corta de una zona horaria, como "GMT-6", para que ninguna hora
 * quede sin decir a qué reloj pertenece.
 */
export function timeZoneAbbr(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("es-CR", { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

export function formatDayTab(date, timeZone = CR_TZ) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDayLong(date, timeZone = CR_TZ) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatSlotTime(date, timeZone = CR_TZ) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSelectedLabel(date, timeZone = CR_TZ) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export { CR_TZ };
