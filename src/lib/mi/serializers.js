// src/lib/mi/serializers.js
// Formas de selección y DTOs compartidos por los endpoints /api/mi/*.
// Envía solo lo que la PWA necesita (nunca datos clínicos ni campos internos).

import { detalleLugarCita } from "@/lib/lugar-cita";

export const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];
export const ACTIVE_PAYMENT_STATUSES = ["PENDING", "LINK_SENT"];

// Select de cita reutilizable (resumen + agenda).
export const appointmentSelect = {
  id: true,
  date: true,
  endDate: true,
  status: true,
  paymentStatus: true,
  meetLink: true,
  // Dónde es la cita. Es la copia congelada de la cita, no el lugar vivo: si el
  // profesional edita o borra el consultorio, la agenda sigue diciendo a dónde
  // se citó a esta persona.
  modality: true,
  locationName: true,
  locationAddress: true,
  locationNotes: true,
  service: { select: { title: true } },
  professional: {
    select: {
      specialty: true,
      slug: true,
      user: { select: { name: true, image: true } },
    },
  },
};

export function appointmentDTO(a) {
  if (!a) return null;
  return {
    id: a.id,
    date: a.date,
    endDate: a.endDate ?? null,
    status: a.status,
    paymentStatus: a.paymentStatus ?? null,
    meetLink: a.meetLink ?? null,
    servicio: a.service?.title ?? null,
    lugar: detalleLugarCita(a),
    profesional: {
      name: a.professional?.user?.name ?? null,
      image: a.professional?.user?.image ?? null,
      specialty: a.professional?.specialty ?? null,
      slug: a.professional?.slug ?? null,
    },
  };
}

/** Una cita es gestionable (cancelar/reagendar) si está activa y es futura. */
export function isManageable(a, now = Date.now()) {
  return UPCOMING_STATUSES.includes(a.status) && new Date(a.date).getTime() >= now;
}
