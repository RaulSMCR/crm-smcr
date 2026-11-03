// src/lib/pro/contexto-para-agendar.js
//
// Lo que necesita el modal de «Nueva cita / Próxima sesión» para ofrecer
// horarios: servicios con tarifa vigente, la franja semanal, lo ya ocupado
// (citas, bloqueos y Google) y los pacientes del profesional.
//
// Lo usan el panel (/panel/profesional/citas) y la app (/pro). Vive en un solo
// lugar para que los dos ofrezcan exactamente los mismos huecos: si uno mirara
// Google y el otro no, el mismo horario estaría libre en una pantalla y ocupado
// en la otra.

import { prisma } from "@/lib/prisma";
import { listBlocksInWindow, blocksToIntervals } from "@/lib/schedule-blocks";
import { fetchBusyForProfessional } from "@/lib/google-busy";
import { TARIFA_VIGENTE } from "@/lib/service-pricing";
import { wherePacientesDelProfesional } from "@/lib/casos";
import { DIAS_HACIA_ADELANTE } from "@/lib/appointment-slots";

export async function contextoParaAgendar(professionalId) {
  const desde = new Date();
  // La misma ventana hasta la que deja mirar el selector de horarios.
  const hasta = new Date(desde.getTime() + DIAS_HACIA_ADELANTE * 24 * 60 * 60 * 1000);

  const [perfil, asignaciones, availability, citasFuturas, patients, bloqueos] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { id: professionalId }, select: { slug: true } }),
    prisma.serviceAssignment.findMany({
      where: { professionalId, status: "APPROVED", rates: { some: TARIFA_VIGENTE }, service: { isActive: true } },
      // Sin `price`: es Decimal, no se puede pasar a un componente de cliente, y
      // el precio real sale de la tarifa al crear la cita.
      select: { service: { select: { id: true, title: true, durationMin: true } } },
    }),
    prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
        date: { gte: desde },
      },
      select: { date: true, endDate: true, gcalEventId: true },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: wherePacientesDelProfesional(professionalId),
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    listBlocksInWindow({ professionalId, from: desde, to: hasta }),
  ]);

  const googleBusy = await fetchBusyForProfessional({
    prisma,
    professionalId,
    from: desde,
    to: hasta,
    excludeEventIds: citasFuturas.map((cita) => cita.gcalEventId),
  });

  return {
    // Define cada cuánto arranca un cupo (ver appointmentIntervalMin).
    professionalSlug: perfil?.slug || "",
    services: asignaciones.map((asignacion) => asignacion.service).filter(Boolean),
    availability,
    // Citas tomadas y bloqueos de agenda en una sola lista de ratos ocupados.
    booked: [
      ...citasFuturas.map((cita) => ({ startISO: cita.date.toISOString(), endISO: cita.endDate.toISOString() })),
      ...blocksToIntervals(bloqueos),
      ...googleBusy,
    ],
    patients,
  };
}
