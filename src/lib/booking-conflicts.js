import { prisma } from "@/lib/prisma";
import { fetchBusyForProfessional } from "@/lib/google-busy";

export const CANCELLED_APPOINTMENT_STATUSES = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

export function formatConflictDate(date) {
  // En hora de Costa Rica, la de la agenda. Sin zona explícita salía en la del
  // servidor, que en Vercel es UTC: el aviso de conflicto nombraba otra hora.
  return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function buildOccurrenceEnds(starts, durationMin) {
  return starts.map((start) => new Date(start.getTime() + durationMin * 60000));
}

export function findConflictInOccurrences(existingAppointments, starts, ends) {
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = ends[index];
    if (existingAppointments.some((appointment) => appointment.date < end && appointment.endDate > start)) {
      return { index, start };
    }
  }
  return null;
}

/** Rango que cubre todas las ocurrencias, para acotar la consulta a una sola lectura. */
export function buildOverlapWindow(starts, ends) {
  return {
    minStart: starts.reduce((min, current) => (current < min ? current : min), starts[0]),
    maxEnd: ends.reduce((max, current) => (current > max ? current : max), ends[0]),
  };
}

export function buildOverlapWhere({ professionalId, minStart, maxEnd, ignoreAppointmentId }) {
  return {
    professionalId,
    ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    status: { notIn: CANCELLED_APPOINTMENT_STATUSES },
    date: { lt: maxEnd },
    endDate: { gt: minStart },
  };
}

/**
 * Devuelve `{ index, start }` de la primera ocurrencia traslapada, o `null`.
 *
 * Considera dos cosas que ocupan la agenda: las citas ya tomadas y los bloqueos
 * que el profesional declaró (`ScheduleBlock`). La verificación de bloqueos vive
 * acá, y no en cada llamador, porque este módulo es el único punto por el que
 * pasan las seis vías de reserva del sistema; ponerla en la interfaz que arma
 * los horarios no alcanzaría, porque una pestaña vieja o una llamada directa a
 * la server action se saltarían el filtro.
 *
 * Los bloqueos se representan como intervalos ocupados, igual que las citas: a
 * quien reserva le da lo mismo por qué el rato no está libre.
 */
export async function findRecurringConflict({ professionalId, starts, ends, ignoreAppointmentId }) {
  if (!starts.length) return null;

  const { minStart, maxEnd } = buildOverlapWindow(starts, ends);
  const [existingAppointments, blocks, ownEvents] = await Promise.all([
    prisma.appointment.findMany({
      where: buildOverlapWhere({ professionalId, minStart, maxEnd, ignoreAppointmentId }),
      select: { date: true, endDate: true },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        professionalId,
        startsAt: { lt: maxEnd },
        endsAt: { gt: minStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    // Los eventos que la app misma publicó en Google, para no contarlos dos
    // veces. Se pide la ventana completa —sin `ignoreAppointmentId`— porque
    // justamente la cita que se está moviendo es la que hay que excluir del
    // lado de Google para que no choque contra su propio evento.
    prisma.appointment.findMany({
      where: {
        professionalId,
        gcalEventId: { not: null },
        date: { lt: maxEnd },
        endDate: { gt: minStart },
      },
      select: { gcalEventId: true },
    }),
  ]);

  // Lo que el profesional tenga agendado por fuera del sistema. Si no conectó
  // Google, o si Google no responde, esto vuelve vacío y el resto sigue igual.
  const googleBusy = await fetchBusyForProfessional({
    prisma,
    professionalId,
    from: minStart,
    to: maxEnd,
    excludeEventIds: ownEvents.map((appointment) => appointment.gcalEventId),
  });

  const occupied = [
    ...existingAppointments,
    ...blocks.map((block) => ({ date: block.startsAt, endDate: block.endsAt })),
    ...googleBusy.map((busy) => ({ date: new Date(busy.startISO), endDate: new Date(busy.endISO) })),
  ];

  return findConflictInOccurrences(occupied, starts, ends);
}

/**
 * La misma verificación para un único horario.
 *
 * Existe para que los llamadores que agendan una sola cita no repitan a mano la
 * consulta de solapamiento y se olviden de los bloqueos, que fue justo lo que
 * pasaba en `admin-appointments-actions` y en el seguimiento de `agenda-actions`.
 */
export async function findSingleSlotConflict({ professionalId, start, end, ignoreAppointmentId }) {
  return findRecurringConflict({
    professionalId,
    starts: [start],
    ends: [end],
    ignoreAppointmentId,
  });
}
