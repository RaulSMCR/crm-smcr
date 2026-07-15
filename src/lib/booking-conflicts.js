import { prisma } from "@/lib/prisma";

export const CANCELLED_APPOINTMENT_STATUSES = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

export function formatConflictDate(date) {
  return new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
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

/** Devuelve `{ index, start }` de la primera ocurrencia traslapada, o `null`. */
export async function findRecurringConflict({ professionalId, starts, ends, ignoreAppointmentId }) {
  if (!starts.length) return null;

  const { minStart, maxEnd } = buildOverlapWindow(starts, ends);
  const existingAppointments = await prisma.appointment.findMany({
    where: buildOverlapWhere({ professionalId, minStart, maxEnd, ignoreAppointmentId }),
    select: { date: true, endDate: true },
  });

  return findConflictInOccurrences(existingAppointments, starts, ends);
}
