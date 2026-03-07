'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";
import { scheduleReminder } from "@/lib/qstash";
import {
  buildRecurringStarts,
  normalizeRecurrenceCount,
  normalizeRecurrenceRule,
  RECURRENCE_RULES,
} from "@/lib/appointment-recurrence";

const CANCELLED_STATUSES = ['CANCELLED_BY_USER', 'CANCELLED_BY_PRO'];

function buildOccurrenceEnds(starts, durationMin) {
  return starts.map((start) => new Date(start.getTime() + durationMin * 60000));
}

function formatConflictDate(date) {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function findRecurringConflict({ professionalId, starts, ends }) {
  if (!starts.length) return null;

  const minStart = starts.reduce((min, current) => (current < min ? current : min), starts[0]);
  const maxEnd = ends.reduce((max, current) => (current > max ? current : max), ends[0]);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      status: { notIn: CANCELLED_STATUSES },
      date: { lt: maxEnd },
      endDate: { gt: minStart },
    },
    select: { date: true, endDate: true },
  });

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = ends[index];
    const hasConflict = existingAppointments.some(
      (appointment) => appointment.date < end && appointment.endDate > start
    );

    if (hasConflict) {
      return `Hay un conflicto en ${formatConflictDate(start)}. Ajuste la recurrencia e intente nuevamente.`;
    }
  }

  return null;
}

async function hydrateAppointments(appointmentIds) {
  if (!appointmentIds.length) return [];

  return prisma.appointment.findMany({
    where: { id: { in: appointmentIds } },
    include: {
      patient: { select: { name: true, email: true } },
      professional: {
        select: {
          id: true,
          googleRefreshToken: true,
          user: { select: { name: true, email: true } },
        },
      },
      service: { select: { title: true } },
    },
    orderBy: { date: "asc" },
  });
}

async function notifyAppointments(appointments, reason) {
  await Promise.allSettled(
    appointments.flatMap((appointment) => {
      const appointmentMs = appointment.date.getTime();
      return [
        syncGoogleCalendarEvent(appointment),
        sendAppointmentNotifications(appointment, reason),
        scheduleReminder({ appointmentId: appointment.id, type: "24h", sendAt: new Date(appointmentMs - 24 * 60 * 60 * 1000) }),
        scheduleReminder({ appointmentId: appointment.id, type: "1h", sendAt: new Date(appointmentMs - 60 * 60 * 1000) }),
      ];
    })
  );
}

export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay();

    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        dayOfWeek: dayOfWeek
      },
      orderBy: { startTime: 'asc' }
    });

    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: CANCELLED_STATUSES },
        date: {
          gte: startOfDay(searchDate),
          lte: endOfDay(searchDate)
        }
      },
      select: { date: true, endDate: true }
    });

    let freeSlots = [];
    const now = new Date();

    for (const block of availability) {
      let currentSlot = parse(`${dateString}T${block.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      const blockEnd = parse(`${dateString}T${block.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());

      while (isBefore(addMinutes(currentSlot, durationMin), addMinutes(blockEnd, 1))) {
        const slotEnd = addMinutes(currentSlot, durationMin);

        if (isBefore(currentSlot, now)) {
          currentSlot = slotEnd;
          continue;
        }

        const isOccupied = appointments.some(app => {
          return (currentSlot < app.endDate) && (slotEnd > app.date);
        });

        if (!isOccupied) {
          freeSlots.push(format(currentSlot, "HH:mm"));
        }

        currentSlot = slotEnd;
      }
    }

    freeSlots = [...new Set(freeSlots)].sort();
    return { success: true, slots: freeSlots };

  } catch (error) {
    console.error("Error calculando slots:", error);
    return { success: false, error: "Error al calcular disponibilidad." };
  }
}

export async function requestAppointment(
  professionalId,
  dateString,
  timeString,
  serviceId,
  recurrenceRule,
  recurrenceCount
) {
  const session = await getSession();

  if (!session || !session.sub) {
    return { error: "Debe iniciar sesi�n para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    let duration = 60;
    let pricePaid = null;

    if (serviceId) {
      const assignment = await prisma.serviceAssignment.findUnique({
        where: {
          professionalId_serviceId: {
            professionalId,
            serviceId,
          },
        },
        select: {
          status: true,
          approvedSessionPrice: true,
          service: { select: { durationMin: true, price: true } },
        },
      });

      if (!assignment || assignment.status !== "APPROVED") {
        return { error: "El servicio seleccionado no está disponible para este profesional." };
      }

      duration = assignment.service?.durationMin || 60;
      const approvedPrice = Number(assignment.approvedSessionPrice);
      const fallbackPrice = Number(assignment.service?.price);
      pricePaid = Number.isFinite(approvedPrice)
        ? approvedPrice
        : Number.isFinite(fallbackPrice)
          ? fallbackPrice
          : null;
    }

    const dateTimeString = `${dateString}T${timeString}:00`;
    const localDateTime = parse(dateTimeString, "yyyy-MM-dd'T'HH:mm:ss", new Date());
    const startDateTime = fromZonedTime(localDateTime, 'America/Costa_Rica');
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);
    const starts = buildRecurringStarts(startDateTime, rule, count);
    const ends = buildOccurrenceEnds(starts, duration);

    if (starts.some((start) => start <= new Date())) {
      return { error: "Uno de los horarios de la serie ya pasó." };
    }

    const conflictError = await findRecurringConflict({
      professionalId,
      starts,
      ends,
    });

    if (conflictError) {
      return { error: conflictError };
    }

    // Determinar si es la primera cita de este paciente con este profesional
    const previousCount = await prisma.appointment.count({
      where: {
        patientId: session.sub,
        professionalId,
        status: { notIn: CANCELLED_STATUSES },
      },
    });
    const isFirstWithProfessional = previousCount === 0;

    const createdAppointments = await prisma.$transaction(
      starts.map((start, index) =>
        prisma.appointment.create({
          data: {
            date: start,
            endDate: ends[index],
            status: 'PENDING',
            patientId: session.sub,
            professionalId: professionalId,
            serviceId: serviceId || undefined,
            pricePaid,
            isFirstWithProfessional,
          },
          select: { id: true }
        })
      )
    );

    const hydratedAppointments = await hydrateAppointments(createdAppointments.map((item) => item.id));
    await notifyAppointments(hydratedAppointments, "Se creó una nueva cita en estado pendiente.");

    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');

    const depositAmount = isFirstWithProfessional && pricePaid
      ? Math.round(Number(pricePaid) * 0.5)
      : null;

    return {
      success: true,
      appointmentId: hydratedAppointments[0]?.id || null,
      createdCount: hydratedAppointments.length,
      requiresDeposit: isFirstWithProfessional && !!pricePaid,
      depositAmount,
    };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}


