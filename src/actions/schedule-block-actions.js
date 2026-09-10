// src/actions/schedule-block-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireProfessionalProfileId } from "@/lib/auth-guards";
import { blockRangeToInstants } from "@/lib/schedule-blocks";
import { fetchBusyForProfessional } from "@/lib/google-busy";
import { buildScheduleOverview } from "@/lib/schedule-overview";
import { crAddDays, crDay } from "@/lib/appointment-slots";

/**
 * Bloqueos de agenda del profesional.
 *
 * El profesional es dueño de su tiempo: acá declara los ratos en que no
 * atiende. Lo único que no se le deja hacer en silencio es tapar una cita ya
 * agendada, porque del otro lado hay un paciente que la espera.
 */

function revalidar() {
  revalidatePath("/panel/profesional/horarios");
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/profesional");
}

export async function listScheduleBlocks() {
  try {
    const professionalId = await requireProfessionalProfileId();

    // Solo lo que todavía importa: un bloqueo terminado no le sirve a nadie y
    // ensuciaría la lista con meses de historial.
    const rows = await prisma.scheduleBlock.findMany({
      where: { professionalId, endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true, reason: true },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        startISO: row.startsAt.toISOString(),
        endISO: row.endsAt.toISOString(),
        reason: row.reason || "",
      })),
    };
  } catch (error) {
    console.error("Error listando bloqueos de agenda:", error);
    return { success: false, error: "No se pudieron cargar los bloqueos.", data: [] };
  }
}

export async function createScheduleBlock({ date, startTime, endTime, allDay = false, reason = "" }) {
  try {
    const professionalId = await requireProfessionalProfileId();

    const range = blockRangeToInstants({ date, startTime, endTime, allDay });
    if (range.error) return { success: false, error: range.error };

    const { startsAt, endsAt } = range;
    if (endsAt <= new Date()) {
      return { success: false, error: "Ese rango ya pasó. Elija una fecha futura." };
    }

    // Se avisa, no se impide a ciegas: si hay una cita adentro, el profesional
    // tiene que reprogramarla o cancelarla primero, para que nadie se quede
    // esperando en un horario que el sistema dio por cerrado.
    const clash = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
        date: { lt: endsAt },
        endDate: { gt: startsAt },
      },
      select: { date: true },
      orderBy: { date: "asc" },
    });

    if (clash) {
      const cuando = new Intl.DateTimeFormat("es-CR", {
        timeZone: "America/Costa_Rica",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(clash.date);

      return {
        success: false,
        error: `Tiene una cita agendada el ${cuando}, dentro de ese rango. Reprográmela o cancélela antes de bloquear esas horas.`,
      };
    }

    await prisma.scheduleBlock.create({
      data: {
        professionalId,
        startsAt,
        endsAt,
        reason: String(reason || "").trim().slice(0, 200) || null,
      },
    });

    revalidar();
    return { success: true };
  } catch (error) {
    console.error("Error creando bloqueo de agenda:", error);
    return { success: false, error: "No se pudo guardar el bloqueo." };
  }
}

export async function deleteScheduleBlock(id) {
  try {
    const professionalId = await requireProfessionalProfileId();

    // El `professionalId` va en el where y no solo en una comprobación posterior:
    // así nadie puede borrar el bloqueo de otro pasando un id ajeno.
    const result = await prisma.scheduleBlock.deleteMany({
      where: { id: String(id || ""), professionalId },
    });

    if (result.count === 0) return { success: false, error: "Ese bloqueo ya no existe." };

    revalidar();
    return { success: true };
  } catch (error) {
    console.error("Error eliminando bloqueo de agenda:", error);
    return { success: false, error: "No se pudo eliminar el bloqueo." };
  }
}

const CANCELADAS = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

/**
 * La agenda del profesional para dibujarla: franja declarada, citas del sistema,
 * bloqueos manuales y lo ocupado en su Google Calendar.
 *
 * `weekOffset` corre la ventana de a siete días desde hoy.
 */
export async function getScheduleOverview({ weekOffset = 0, days = 7 } = {}) {
  try {
    const professionalId = await requireProfessionalProfileId();

    const desplazamiento = Number(weekOffset) || 0;
    const fromYMD = crAddDays(crDay(new Date()), desplazamiento * 7);
    // El fin es exclusivo: el primer instante del día siguiente al último.
    const from = new Date(`${fromYMD}T00:00:00-06:00`);
    const to = new Date(`${crAddDays(fromYMD, days)}T00:00:00-06:00`);

    const [availability, appointments, blocks] = await Promise.all([
      prisma.availability.findMany({
        where: { professionalId },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      }),
      prisma.appointment.findMany({
        where: {
          professionalId,
          status: { notIn: CANCELADAS },
          date: { lt: to },
          endDate: { gt: from },
        },
        select: {
          date: true,
          endDate: true,
          gcalEventId: true,
          patient: { select: { name: true } },
          service: { select: { title: true } },
        },
      }),
      prisma.scheduleBlock.findMany({
        where: { professionalId, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true, reason: true },
      }),
    ]);

    const googleBusy = await fetchBusyForProfessional({
      prisma,
      professionalId,
      from,
      to,
      excludeEventIds: appointments.map((cita) => cita.gcalEventId),
    });

    const overview = buildScheduleOverview({
      fromYMD,
      days,
      availability,
      appointments: appointments.map((cita) => ({
        startISO: cita.date.toISOString(),
        endISO: cita.endDate.toISOString(),
        label: cita.patient?.name || cita.service?.title || "Cita",
      })),
      blocks: blocks.map((bloque) => ({
        startISO: bloque.startsAt.toISOString(),
        endISO: bloque.endsAt.toISOString(),
        label: bloque.reason || "Bloqueo",
      })),
      googleBusy: googleBusy.map((evento) => ({
        startISO: evento.startISO,
        endISO: evento.endISO,
        label: evento.summary || "Evento de Google",
      })),
    });

    return {
      success: true,
      data: {
        ...overview,
        weekOffset: desplazamiento,
        // Si el profesional no conectó Google, la vista lo dice en vez de
        // mostrar una capa vacía que parecería "no tengo nada agendado".
        googleConectado: googleBusy.length > 0 || (await tieneGoogle(professionalId)),
      },
    };
  } catch (error) {
    console.error("Error armando la vista de agenda:", error);
    return { success: false, error: "No se pudo cargar la agenda." };
  }
}

async function tieneGoogle(professionalId) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId) },
    select: { googleRefreshToken: true },
  });
  return Boolean(profile?.googleRefreshToken);
}
