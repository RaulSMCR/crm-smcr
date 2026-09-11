import { prisma } from "@/lib/prisma";
import { listBlocksInWindow, blocksToIntervals } from "@/lib/schedule-blocks";
import { fetchBusyForProfessional, fetchWarningsForProfessional } from "@/lib/google-busy";
import { CANCELLED_APPOINTMENT_STATUSES } from "@/lib/booking-conflicts";

/**
 * Lo que hace falta para ofrecer horarios de un profesional en una ventana: su
 * semana tipo, lo que ya le ocupa la agenda y las advertencias (feriados).
 *
 * Lo ocupado junta tres fuentes —citas tomadas, bloqueos propios y su Google
 * Calendar— porque la página pública de agendar miraba solo las citas: el
 * paciente veía libres ratos que el profesional tenía tomados en Google o
 * bloqueados. Tenerlo en un solo lugar evita que la próxima pantalla se olvide
 * de alguna.
 *
 * Los intervalos ocupados salen sin título. El de un evento de Google es del
 * profesional y puede nombrar a un paciente; a quien reserva le basta saber que
 * el rato no está libre, y lo que se le pasa a un componente de cliente viaja
 * completo al navegador.
 */
export async function cargarAgendaReservable({ professionalId, from, to }) {
  const [availability, citas, bloqueos] = await Promise.all([
    prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: CANCELLED_APPOINTMENT_STATUSES },
        date: { lt: to },
        endDate: { gt: from },
      },
      select: { date: true, endDate: true, gcalEventId: true },
    }),
    listBlocksInWindow({ professionalId, from, to }),
  ]);

  // Google nunca puede tumbar la agenda: si no responde, se ofrece lo que dicen
  // la semana tipo, las citas y los bloqueos.
  const [googleBusy, warnings] = await Promise.all([
    fetchBusyForProfessional({
      prisma,
      professionalId,
      from,
      to,
      // Las citas que la app publicó en Google ya se cuentan desde la base.
      excludeEventIds: citas.map((cita) => cita.gcalEventId),
    }).catch((error) => {
      console.error("No se pudo leer lo ocupado en Google:", error?.message);
      return [];
    }),
    fetchWarningsForProfessional({ prisma, professionalId, from, to }).catch((error) => {
      console.error("No se pudieron leer las advertencias de Google:", error?.message);
      return [];
    }),
  ]);

  const booked = [
    ...citas
      .filter((cita) => cita.date && cita.endDate)
      .map((cita) => ({ startISO: cita.date.toISOString(), endISO: cita.endDate.toISOString() })),
    ...blocksToIntervals(bloqueos),
    ...googleBusy.map(({ startISO, endISO }) => ({ startISO, endISO })),
  ];

  return { availability, booked, warnings };
}
