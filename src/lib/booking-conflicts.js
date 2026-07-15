export const CANCELLED_APPOINTMENT_STATUSES = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

export function formatConflictDate(date) {
  return new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
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
