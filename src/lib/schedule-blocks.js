import { prisma } from "@/lib/prisma";

/**
 * Bloqueos de agenda: los ratos en que el profesional no atiende.
 *
 * La disponibilidad semanal (`Availability`) dice cuándo atiende en una semana
 * tipo. Esto le resta excepciones puntuales: vacaciones, un viaje, una urgencia.
 */

/**
 * Costa Rica no aplica horario de verano, así que el offset es siempre -06:00.
 * El resto del proyecto ya se apoya en eso (ver `lib/fe/signer.js`), y por eso
 * se puede construir el instante pegando el offset al texto en vez de arrastrar
 * una librería de zonas horarias.
 */
const CR_OFFSET = "-06:00";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Fin del día como instante: el 00:00 del día siguiente. */
function startOfNextDay(dateYMD) {
  const [year, month, day] = dateYMD.split("-").map(Number);
  // Date.UTC normaliza el desborde de mes y de año por su cuenta.
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Convierte lo que el profesional escribió (fecha y horas en hora de Costa
 * Rica) en el par de instantes absolutos que se guarda.
 *
 * Devuelve `{ error }` en vez de lanzar: los llamadores son server actions que
 * ya devuelven ese formato al formulario.
 */
export function blockRangeToInstants({ date, startTime, endTime, allDay = false }) {
  const day = String(date || "").trim();
  if (!YMD.test(day)) return { error: "Indique una fecha válida." };

  if (allDay) {
    return {
      startsAt: new Date(`${day}T00:00:00${CR_OFFSET}`),
      endsAt: new Date(`${startOfNextDay(day)}T00:00:00${CR_OFFSET}`),
    };
  }

  const from = String(startTime || "").trim();
  const to = String(endTime || "").trim();
  if (!HHMM.test(from) || !HHMM.test(to)) {
    return { error: "Indique horas válidas en formato HH:MM." };
  }
  if (from >= to) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  return {
    startsAt: new Date(`${day}T${from}:00${CR_OFFSET}`),
    endsAt: new Date(`${day}T${to}:00${CR_OFFSET}`),
  };
}

/** Los bloqueos que pisan la ventana `[from, to)`, para restarlos de la agenda. */
export async function listBlocksInWindow({ professionalId, from, to }) {
  if (!professionalId) return [];
  return prisma.scheduleBlock.findMany({
    where: {
      professionalId,
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Los pasa al formato de intervalos que consume `buildSlots`.
 *
 * Es el mismo que el de las citas tomadas a propósito: para quien arma los
 * horarios, un bloqueo y una cita ajena son lo mismo, un rato que no se ofrece.
 */
export function blocksToIntervals(blocks = []) {
  return blocks.map((block) => ({
    startISO: block.startsAt.toISOString(),
    endISO: block.endsAt.toISOString(),
  }));
}
