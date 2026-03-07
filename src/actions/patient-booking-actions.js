"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/actions/auth-actions";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";
import { scheduleReminder } from "@/lib/qstash";
import {
  buildRecurringStarts,
  normalizeRecurrenceCount,
  normalizeRecurrenceRule,
  RECURRENCE_RULES,
} from "@/lib/appointment-recurrence";

const CANCELLED_STATUSES = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

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

async function findRecurringConflict({ professionalId, starts, ends, ignoreAppointmentId }) {
  if (!starts.length) return null;

  const minStart = starts.reduce((min, current) => (current < min ? current : min), starts[0]);
  const maxEnd = ends.reduce((max, current) => (current > max ? current : max), ends[0]);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
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
      return `Hay un conflicto en ${formatConflictDate(start)}. Ajuste la serie e intentelo nuevamente para mantener una coordinacion segura.`;
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
        scheduleReminder({
          appointmentId: appointment.id,
          type: "24h",
          sendAt: new Date(appointmentMs - 24 * 60 * 60 * 1000),
        }),
        scheduleReminder({
          appointmentId: appointment.id,
          type: "1h",
          sendAt: new Date(appointmentMs - 60 * 60 * 1000),
        }),
      ];
    })
  );
}

export async function createAppointmentForPatient({
  professionalId,
  serviceId,
  startISO,
  recurrenceRule,
  recurrenceCount,
}) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Debe iniciar sesión." };
    if (session.role !== "USER") return { success: false, error: "No autorizado." };

    const patientId = String(session.sub);
    const pid = String(professionalId || "");
    const sid = String(serviceId || "");
    const start = new Date(String(startISO || ""));
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

    if (!pid || !sid || Number.isNaN(start.getTime())) {
      return { success: false, error: "Datos invÃ¡lidos para agendar." };
    }
    if (start < new Date()) {
      return { success: false, error: "El horario seleccionado ya pasÃ³." };
    }

    const [service, professional, assignment] = await Promise.all([
      prisma.service.findUnique({
        where: { id: sid },
        select: { id: true, durationMin: true, price: true, isActive: true },
      }),
      prisma.professionalProfile.findUnique({
        where: { id: pid },
        select: { id: true, isApproved: true, user: { select: { isActive: true } } },
      }),
      prisma.serviceAssignment.findUnique({
        where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
        select: { status: true, approvedSessionPrice: true },
      }),
    ]);

    if (!service || !service.isActive) return { success: false, error: "Servicio no disponible." };
    if (!professional || !professional.isApproved || !professional.user?.isActive) {
      return { success: false, error: "Profesional no disponible." };
    }
    if (!assignment || assignment.status !== "APPROVED" || assignment.approvedSessionPrice == null) {
      return { success: false, error: "Este profesional no estÃ¡ habilitado para este servicio." };
    }

    const starts = buildRecurringStarts(start, rule, count);
    const ends = buildOccurrenceEnds(starts, service.durationMin);

    if (starts.some((occurrence) => occurrence <= new Date())) {
      return { success: false, error: "Uno de los horarios de la serie ya pasÃ³." };
    }

    const conflictError = await findRecurringConflict({
      professionalId: pid,
      starts,
      ends,
    });

    if (conflictError) return { success: false, error: conflictError };

    const createdAppointments = await prisma.$transaction(
      starts.map((occurrence, index) =>
        prisma.appointment.create({
          data: {
            patientId,
            professionalId: pid,
            serviceId: sid,
            date: occurrence,
            endDate: ends[index],
            status: "PENDING",
            paymentStatus: "UNPAID",
            pricePaid: assignment.approvedSessionPrice,
          },
          select: { id: true },
        })
      )
    );

    const hydratedAppointments = await hydrateAppointments(createdAppointments.map((item) => item.id));
    await notifyAppointments(hydratedAppointments, "Se creÃ³ una nueva cita en estado pendiente.");

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");

    return {
      success: true,
      appointmentId: hydratedAppointments[0]?.id || null,
      createdCount: hydratedAppointments.length,
    };
  } catch (error) {
    console.error("createAppointmentForPatient error:", error);
    return { success: false, error: "Error interno al agendar. Por favor, intente nuevamente." };
  }
}

export async function cancelAppointmentByPatient(appointmentId, reason) {
  try {
    const session = await getSession();
    if (!session) return { error: "No autorizado: sesiÃ³n requerida." };
    if (session.role !== "USER") return { error: "No autorizado." };

    const patientId = String(session.sub);
    const id = String(appointmentId || "");

    if (!id) return { error: "ID de cita invÃ¡lido." };
    if (!reason || !String(reason).trim()) return { error: "Debe indicar el motivo de cancelación." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        service: true,
        patient: true,
      },
    });

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.patientId !== patientId) return { error: "No es posible cancelar citas de otros usuarios." };
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita no puede cancelarse (estado invÃ¡lido)." };
    }

    const now = new Date();
    const hoursUntilAppointment = (new Date(appointment.date) - now) / (1000 * 60 * 60);
    const isLateCancel = hoursUntilAppointment < 24;

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED_BY_USER",
        cancelReason: String(reason).trim(),
        canceledBy: "PATIENT",
        canceledAt: now,
      },
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
    });

    await Promise.allSettled([
      syncGoogleCalendarEvent(updated),
      sendAppointmentNotifications(updated, "La cita fue cancelada por el paciente."),
    ]);

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");
    return { success: true, isLateCancel };
  } catch (error) {
    console.error("cancelAppointmentByPatient error:", error);
    return { error: "Error interno al cancelar. Por favor, intente nuevamente." };
  }
}

export async function getAppointmentRescheduleData(appointmentId) {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: String(appointmentId || "") },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        include: {
          availability: true,
          appointments: {
            where: {
              id: { not: String(appointmentId || "") },
              status: { notIn: CANCELLED_STATUSES },
              date: { gte: new Date() },
            },
            select: { date: true, endDate: true },
          },
        },
      },
    },
  });

  if (!appointment) return { error: "Cita no encontrada." };
  if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };

  return {
    professionalId: appointment.professionalId,
    durationMin: appointment.service?.durationMin ?? 60,
    availability: appointment.professional.availability,
    booked: appointment.professional.appointments.map((item) => ({
      startISO: item.date.toISOString(),
      endISO: item.endDate.toISOString(),
    })),
  };
}

export async function rescheduleAppointmentByPatient(
  appointmentId,
  newStartISO,
  recurrenceRule,
  recurrenceCount
) {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const id = String(appointmentId || "");
  if (!id) return { error: "ID de cita invÃ¡lido." };

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        include: { user: { select: { name: true, email: true } } },
      },
      patient: { select: { name: true, email: true } },
    },
  });

  if (!appointment) return { error: "Cita no encontrada." };
  if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };
  if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
    return { error: "Esta cita no puede reagendarse." };
  }

  const newStart = new Date(String(newStartISO || ""));
  const rule = normalizeRecurrenceRule(recurrenceRule);
  const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

  if (Number.isNaN(newStart.getTime()) || newStart <= new Date()) {
    return { error: "Horario invÃ¡lido." };
  }

  const durationMin = appointment.service?.durationMin ?? 60;
  const starts = buildRecurringStarts(newStart, rule, count);
  const ends = buildOccurrenceEnds(starts, durationMin);

  const conflictError = await findRecurringConflict({
    professionalId: appointment.professionalId,
    starts,
    ends,
    ignoreAppointmentId: id,
  });

  if (conflictError) return { error: conflictError };

  const extraStarts = starts.slice(1);
  const extraEnds = ends.slice(1);

    const changedAppointments = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          date: starts[0],
          endDate: ends[0],
          status: "PENDING",
          lastRescheduledBy: "PATIENT",
          lastRescheduledAt: new Date(),
          rescheduleCount: { increment: 1 },
        },
        select: { id: true },
      });

    const createdAppointments = [];
    for (let index = 0; index < extraStarts.length; index += 1) {
        const createdAppointment = await tx.appointment.create({
          data: {
            patientId: appointment.patientId,
            professionalId: appointment.professionalId,
            serviceId: appointment.serviceId || undefined,
            date: extraStarts[index],
            endDate: extraEnds[index],
            status: "PENDING",
            paymentStatus: appointment.paymentStatus,
            pricePaid: appointment.pricePaid,
            lastRescheduledBy: "PATIENT",
            lastRescheduledAt: new Date(),
            rescheduleCount: 1,
          },
          select: { id: true },
        });
      createdAppointments.push(createdAppointment);
    }

    return [updatedAppointment, ...createdAppointments];
  });

  const hydratedAppointments = await hydrateAppointments(changedAppointments.map((item) => item.id));
  await notifyAppointments(hydratedAppointments, "La cita fue reagendada por el paciente.");

  revalidatePath("/panel/paciente");
  revalidatePath("/panel/profesional/citas");
  return { success: true, createdCount: hydratedAppointments.length };
}

export async function confirmCurrentAppointmentByPatient(appointmentId) {
  try {
    const session = await getSession();
    if (!session || session.role !== "USER") return { error: "No autorizado." };

    const id = String(appointmentId || "");
    if (!id) return { error: "ID de cita invÃ¡lido." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
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
    });

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita ya no admite confirmaciÃ³n de horario." };
    }

    await sendAppointmentNotifications(
      appointment,
      "El paciente confirmÃ³ que mantiene el horario actual. Puede continuar la gestión de la serie."
    );

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");
    return { success: true };
  } catch (error) {
    console.error("confirmCurrentAppointmentByPatient error:", error);
    return { error: "No se pudo registrar la confirmaciÃ³n." };
  }
}



