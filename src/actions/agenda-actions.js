"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  sendAppointmentNotifications,
  sendRecurringConflictResolutionEmail,
  syncGoogleCalendarEvent,
} from "@/lib/appointments";
import { createBalancePaymentAuto } from "@/actions/payment-actions";
import { scheduleReminder } from "@/lib/qstash";
import { buildSlots } from "@/lib/appointment-slots";
import {
  buildRecurringStarts,
  normalizeRecurrenceCount,
  normalizeRecurrenceRule,
  RECURRENCE_RULES,
} from "@/lib/appointment-recurrence";

const CANCELLED_STATUSES = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];
const ALLOWED_PRO_STATUS = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED_BY_PRO"]);

function toStr(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

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

async function requireProfessionalProfileId() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado: sesión requerida.");
  if (toStr(session.role) !== "PROFESSIONAL") {
    throw new Error("No autorizado: rol PROFESSIONAL requerido.");
  }

  const professionalId = toStr(session.professionalProfileId);
  if (!professionalId) throw new Error("No se encontró professionalProfileId en la sesión.");

  return professionalId;
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

    if (hasConflict) return { conflictStart: start };
  }

  return null;
}

function buildGoogleCalendarDayUrl(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `https://calendar.google.com/calendar/u/0/r/day/${year}/${month}/${day}`;
}

async function findSuggestedCalendarDateForConflict({
  professionalId,
  durationMin,
  fromDate,
  ignoreAppointmentId,
}) {
  const searchStart = new Date(fromDate);
  searchStart.setHours(0, 0, 0, 0);

  const searchEnd = new Date(searchStart);
  searchEnd.setDate(searchEnd.getDate() + 45);

  const [availability, bookedAppointments] = await Promise.all([
    prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
        status: { notIn: CANCELLED_STATUSES },
        date: { gte: searchStart, lt: searchEnd },
      },
      select: { date: true, endDate: true },
      orderBy: { date: "asc" },
    }),
  ]);

  if (!availability.length) return null;

  const days = buildSlots({
    availability,
    durationMin,
    booked: bookedAppointments.map((item) => ({
      startISO: item.date.toISOString(),
      endISO: item.endDate.toISOString(),
    })),
    daysAhead: 45,
    now: searchStart,
  });

  if (!days.length) return null;

  const sameDay = days.find((item) => item.day.toDateString() === searchStart.toDateString());
  if (sameDay) return sameDay.day;

  return days[0].day;
}

async function buildRecurringConflictResponse({
  professionalId,
  durationMin,
  conflictStart,
  ignoreAppointmentId,
}) {
  const suggestedDate =
    (await findSuggestedCalendarDateForConflict({
      professionalId,
      durationMin,
      fromDate: conflictStart,
      ignoreAppointmentId,
    })) || conflictStart;

  const conflictLabel = formatConflictDate(conflictStart);

  return {
    success: false,
    error: `Hay un conflicto en ${conflictLabel}. Revise la serie e intente nuevamente.`,
    errorCode: "RECURRING_CONFLICT",
    conflictDateISO: conflictStart.toISOString(),
    suggestedDateISO: suggestedDate.toISOString(),
    conflictLabel,
    suggestedCalendarUrl: buildGoogleCalendarDayUrl(suggestedDate),
  };
}

async function hydrateAppointments(appointmentIds) {
  if (!appointmentIds.length) return [];

  return prisma.appointment.findMany({
    where: { id: { in: appointmentIds } },
    include: {
      patient: { select: { id: true, name: true, email: true, phone: true } },
      professional: {
        select: {
          id: true,
          googleRefreshToken: true,
          user: { select: { name: true, email: true } },
        },
      },
      service: { select: { id: true, title: true, price: true, durationMin: true } },
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

function revalidateAgendaPaths() {
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/profesional");
  revalidatePath("/panel/paciente");
  revalidatePath("/admin/appointments");
}

export async function getProfessionalRescheduleData(appointmentId) {
  const professionalId = await requireProfessionalProfileId();
  const id = toStr(appointmentId);

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        include: {
          availability: true,
          appointments: {
            where: {
              id: { not: id },
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
  if (appointment.professionalId !== professionalId) return { error: "No autorizado." };

  return {
    durationMin: appointment.service?.durationMin ?? 60,
    availability: appointment.professional.availability,
    booked: appointment.professional.appointments.map((item) => ({
      startISO: item.date.toISOString(),
      endISO: item.endDate.toISOString(),
    })),
  };
}

export async function createAppointmentByProfessional({
  patientId,
  serviceId,
  startISO,
  recurrenceRule,
  recurrenceCount,
}) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const pid = toStr(patientId);
    const sid = toStr(serviceId);
    const start = new Date(toStr(startISO));
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

    if (!pid || !sid || Number.isNaN(start.getTime())) {
      return { success: false, error: "Datos inválidos para agendar." };
    }
    if (start <= new Date()) {
      return { success: false, error: "El horario seleccionado ya pasó." };
    }

    const [patient, service, assignment] = await Promise.all([
      prisma.user.findUnique({
        where: { id: pid },
        select: { id: true, role: true, isActive: true },
      }),
      prisma.service.findUnique({
        where: { id: sid },
        select: { id: true, durationMin: true, isActive: true },
      }),
      prisma.serviceAssignment.findUnique({
        where: { professionalId_serviceId: { professionalId, serviceId: sid } },
        select: { status: true, approvedSessionPrice: true },
      }),
    ]);

    if (!patient || patient.role !== "USER" || !patient.isActive) {
      return { success: false, error: "Paciente no disponible." };
    }
    if (!service || !service.isActive) {
      return { success: false, error: "Servicio no disponible." };
    }
    if (!assignment || assignment.status !== "APPROVED" || assignment.approvedSessionPrice == null) {
      return { success: false, error: "Este servicio no esta habilitado para la agenda." };
    }

    const starts = buildRecurringStarts(start, rule, count);
    const ends = buildOccurrenceEnds(starts, service.durationMin);
    const conflict = await findRecurringConflict({
      professionalId,
      starts,
      ends,
    });

    if (conflict) {
      const conflictResponse = await buildRecurringConflictResponse({
        professionalId,
        durationMin: service.durationMin,
        conflictStart: conflict.conflictStart,
      });

      const conflictAppointment = await prisma.appointment.findFirst({
        where: {
          professionalId,
          patientId: pid,
          serviceId: sid,
          status: "PENDING",
          date: starts[0],
        },
        include: {
          patient: { select: { id: true, name: true, email: true, phone: true } },
          professional: {
            select: {
              id: true,
              googleRefreshToken: true,
              user: { select: { name: true, email: true } },
            },
          },
          service: { select: { id: true, title: true, price: true, durationMin: true } },
        },
      });

      if (conflictAppointment) {
        await sendRecurringConflictResolutionEmail({
          appointment: conflictAppointment,
          conflictLabel: conflictResponse.conflictLabel,
          professionalCalendarUrl: conflictResponse.suggestedCalendarUrl,
        });
      }

      return conflictResponse;
    }

    const createdAppointments = await prisma.$transaction(
      starts.map((occurrence, index) =>
        prisma.appointment.create({
          data: {
            patientId: pid,
            professionalId,
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
    await notifyAppointments(hydratedAppointments, "El profesional creó una nueva cita en estado pendiente.");
    revalidateAgendaPaths();

    return {
      success: true,
      appointmentId: hydratedAppointments[0]?.id || null,
      createdCount: hydratedAppointments.length,
    };
  } catch (error) {
    console.error("createAppointmentByProfessional error:", error);
    return { success: false, error: "Error interno al agendar. Por favor, intentelo nuevamente." };
  }
}

export async function rescheduleAppointmentByProfessional(
  appointmentId,
  newStartISO,
  recurrenceRule,
  recurrenceCount
) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(appointmentId);
    const newStart = new Date(toStr(newStartISO));
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

    if (!id) return { success: false, error: "ID inválido." };
    if (Number.isNaN(newStart.getTime()) || newStart <= new Date()) {
      return { success: false, error: "Horario inválido." };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { durationMin: true } },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.professionalId !== professionalId) {
      return { success: false, error: "No es posible modificar citas de otro profesional." };
    }
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { success: false, error: "Esta cita no puede reagendarse." };
    }

    const durationMin = appointment.service?.durationMin ?? 60;
    const starts = buildRecurringStarts(newStart, rule, count);
    const ends = buildOccurrenceEnds(starts, durationMin);

    const conflict = await findRecurringConflict({
      professionalId,
      starts,
      ends,
      ignoreAppointmentId: id,
    });

    if (conflict) {
      const conflictResponse = await buildRecurringConflictResponse({
        professionalId,
        durationMin,
        conflictStart: conflict.conflictStart,
        ignoreAppointmentId: id,
      });

      const conflictAppointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: { select: { id: true, name: true, email: true, phone: true } },
          professional: {
            select: {
              id: true,
              googleRefreshToken: true,
              user: { select: { name: true, email: true } },
            },
          },
          service: { select: { id: true, title: true, price: true, durationMin: true } },
        },
      });

      if (conflictAppointment) {
        await sendRecurringConflictResolutionEmail({
          appointment: conflictAppointment,
          conflictLabel: conflictResponse.conflictLabel,
          professionalCalendarUrl: conflictResponse.suggestedCalendarUrl,
        });
      }

      return conflictResponse;
    }

    const extraStarts = starts.slice(1);
    const extraEnds = ends.slice(1);

    const changedAppointments = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          date: starts[0],
          endDate: ends[0],
          status: "CONFIRMED",
          lastRescheduledBy: "PROFESSIONAL",
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
            status: "CONFIRMED",
            paymentStatus: appointment.paymentStatus,
            pricePaid: appointment.pricePaid,
            lastRescheduledBy: "PROFESSIONAL",
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
    await notifyAppointments(hydratedAppointments, "La cita fue reagendada por el profesional.");
    revalidateAgendaPaths();

    return { success: true, createdCount: hydratedAppointments.length };
  } catch (error) {
    console.error("rescheduleAppointmentByProfessional error:", error);
    return { success: false, error: "Error interno al reagendar cita." };
  }
}

export async function confirmAppointmentByProfessional(
  appointmentId,
  recurrenceRule,
  recurrenceCount
) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(appointmentId);
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

    if (!id) return { success: false, error: "ID inválido." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { durationMin: true } },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.professionalId !== professionalId) {
      return { success: false, error: "No es posible modificar citas de otro profesional." };
    }
    if (appointment.status !== "PENDING") {
      return { success: false, error: "Solo es posible confirmar citas pendientes." };
    }

    const durationMin =
      appointment.service?.durationMin ??
      Math.max(1, Math.round((new Date(appointment.endDate) - new Date(appointment.date)) / 60000));

    const starts = buildRecurringStarts(new Date(appointment.date), rule, count);
    const ends = buildOccurrenceEnds(starts, durationMin);

    const conflict = await findRecurringConflict({
      professionalId,
      starts,
      ends,
      ignoreAppointmentId: id,
    });

    if (conflict) {
      const conflictResponse = await buildRecurringConflictResponse({
        professionalId,
        durationMin,
        conflictStart: conflict.conflictStart,
        ignoreAppointmentId: id,
      });

      const conflictAppointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          patient: { select: { id: true, name: true, email: true, phone: true } },
          professional: {
            select: {
              id: true,
              googleRefreshToken: true,
              user: { select: { name: true, email: true } },
            },
          },
          service: { select: { id: true, title: true, price: true, durationMin: true } },
        },
      });

      if (conflictAppointment) {
        await sendRecurringConflictResolutionEmail({
          appointment: conflictAppointment,
          conflictLabel: conflictResponse.conflictLabel,
          professionalCalendarUrl: conflictResponse.suggestedCalendarUrl,
        });
      }

      return conflictResponse;
    }

    const extraStarts = starts.slice(1);
    const extraEnds = ends.slice(1);

    const changedAppointments = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          date: starts[0],
          endDate: ends[0],
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
            status: "CONFIRMED",
            paymentStatus: appointment.paymentStatus,
            pricePaid: appointment.pricePaid,
          },
          select: { id: true },
        });
        createdAppointments.push(createdAppointment);
      }

      return [updatedAppointment, ...createdAppointments];
    });

    const hydratedAppointments = await hydrateAppointments(changedAppointments.map((item) => item.id));
    await notifyAppointments(hydratedAppointments, "La cita fue confirmada por el profesional.");
    revalidateAgendaPaths();

    return { success: true, createdCount: hydratedAppointments.length };
  } catch (error) {
    console.error("confirmAppointmentByProfessional error:", error);
    return { success: false, error: "Error interno al confirmar cita." };
  }
}

export async function updateAppointmentStatus(appointmentId, newStatus) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(appointmentId);
    const status = toStr(newStatus);

    if (!id) return { success: false, error: "ID inválido." };
    if (!ALLOWED_PRO_STATUS.has(status)) {
      return { success: false, error: `Estado no permitido: ${status}` };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, professionalId: true, status: true },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.professionalId !== professionalId) {
      return { success: false, error: "No es posible modificar citas de otro profesional." };
    }

    const from = appointment.status;
    const okTransition =
      (from === "PENDING" && (status === "CONFIRMED" || status === "CANCELLED_BY_PRO")) ||
      (from === "CONFIRMED" &&
        (status === "COMPLETED" || status === "NO_SHOW" || status === "CANCELLED_BY_PRO"));

    if (!okTransition) {
      return { success: false, error: `Transición inválida: ${from} -> ${status}` };
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status },
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
      syncGoogleCalendarEvent(updatedAppointment),
      sendAppointmentNotifications(updatedAppointment, `La cita cambió de estado a ${status}.`),
      ...(status === "COMPLETED" ? [createBalancePaymentAuto(id)] : []),
    ]);

    revalidateAgendaPaths();
    return { success: true };
  } catch (error) {
    console.error("updateAppointmentStatus error:", error);
    return { success: false, error: "Error interno al actualizar cita." };
  }
}

export async function cancelAppointmentByProfessional(appointmentId, reason) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(appointmentId);
    const reasonStr = toStr(reason).trim();

    if (!id) return { error: "ID de cita inválido." };
    if (!reasonStr) return { error: "Debes indicar el motivo de cancelación." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        patient: true,
        service: true,
      },
    });

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.professionalId !== professionalId) {
      return { error: "No es posible cancelar citas de otro profesional." };
    }
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita no puede cancelarse (estado inválido)." };
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED_BY_PRO",
        cancelReason: reasonStr,
        canceledBy: "PROFESSIONAL",
        canceledAt: new Date(),
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
      sendAppointmentNotifications(updated, `La cita fue cancelada por el profesional: "${reasonStr}"`),
    ]);

    revalidateAgendaPaths();
    return { success: true };
  } catch (error) {
    console.error("cancelAppointmentByProfessional error:", error);
    return { error: "Error interno al cancelar. Por favor, intentelo nuevamente." };
  }
}

export async function getFollowUpScheduleData(parentAppointmentId) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(parentAppointmentId);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { durationMin: true, title: true } },
        patient: { select: { name: true } },
        professional: {
          include: {
            availability: true,
            appointments: {
              where: {
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
    if (appointment.professionalId !== professionalId) return { error: "No autorizado." };
    if (appointment.status !== "COMPLETED") return { error: "Solo se puede agendar seguimiento de citas completadas." };

    return {
      durationMin: appointment.service?.durationMin ?? 60,
      availability: appointment.professional.availability,
      booked: appointment.professional.appointments.map((item) => ({
        startISO: item.date.toISOString(),
        endISO: item.endDate.toISOString(),
      })),
      patientName: appointment.patient?.name ?? "",
      serviceName: appointment.service?.title ?? "Consulta",
    };
  } catch (error) {
    console.error("getFollowUpScheduleData error:", error);
    return { error: "Error interno al cargar disponibilidad." };
  }
}

export async function createFollowUpAppointment(parentAppointmentId, startISO) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(parentAppointmentId);

    const parent = await prisma.appointment.findUnique({
      where: { id },
      include: { service: { select: { durationMin: true } } },
    });

    if (!parent) return { error: "Cita padre no encontrada." };
    if (parent.professionalId !== professionalId) return { error: "No autorizado." };
    if (parent.status !== "COMPLETED") return { error: "Solo se puede agendar seguimiento de citas completadas." };

    const durationMin = parent.service?.durationMin ?? 60;
    const newStart = new Date(startISO);
    const newEnd = new Date(newStart.getTime() + durationMin * 60000);

    if (isNaN(newStart.getTime())) return { error: "Fecha inválida." };

    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { notIn: CANCELLED_STATUSES },
        date: { lt: newEnd },
        endDate: { gt: newStart },
      },
    });

    if (conflict) return { error: "Conflicto: ya existe una cita en ese horario." };

    const created = await prisma.appointment.create({
      data: {
        date: newStart,
        endDate: newEnd,
        status: "PENDING",
        patientId: parent.patientId,
        professionalId: parent.professionalId,
        serviceId: parent.serviceId,
        parentAppointmentId: id,
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
      syncGoogleCalendarEvent(created),
      sendAppointmentNotifications(created, "Se agendó una cita de seguimiento."),
    ]);

    revalidateAgendaPaths();
    return { success: true };
  } catch (error) {
    console.error("createFollowUpAppointment error:", error);
    return { error: "Error interno al agendar el seguimiento." };
  }
}

