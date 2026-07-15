export const APPOINTMENT_OVERLAP_MESSAGE = "Ese horario acaba de ser reservado por otra persona. Elegí otro espacio, por favor.";

export function isAppointmentOverlapError(error) {
  const message = String(error?.message || error || "");
  return error?.code === "P2010" && message.includes("23P01") || message.includes("appointment_no_overlap") || message.includes("exclusion constraint");
}

