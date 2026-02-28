// src/actions/patient-booking-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/actions/auth-actions";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";

export async function createAppointmentForPatient({ professionalId, serviceId, startISO }) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Debes iniciar sesión." };
    if (session.role !== "USER") return { success: false, error: "No autorizado." };

    const patientId = String(session.sub);
    const pid = String(professionalId || "");
    const sid = String(serviceId || "");
    const start = new Date(String(startISO || ""));

    if (!pid || !sid || Number.isNaN(start.getTime())) {
      return { success: false, error: "Datos inválidos para agendar." };
    }
    if (start < new Date()) {
      return { success: false, error: "El horario seleccionado ya pasó." };
    }

    const [service, pro, assignment] = await Promise.all([
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
    if (!pro || !pro.isApproved || !pro.user?.isActive) return { success: false, error: "Profesional no disponible." };
    if (!assignment || assignment.status !== "APPROVED" || assignment.approvedSessionPrice == null) {
      return { success: false, error: "Este profesional no está habilitado para este servicio." };
    }

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + service.durationMin);

    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId: pid,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
        date: { lt: end },
        endDate: { gt: start },
      },
      select: { id: true },
    });

    if (conflict) return { success: false, error: "Ese horario ya fue tomado. Elige otro." };

    const appt = await prisma.appointment.create({
      data: {
        patientId,
        professionalId: pid,
        serviceId: sid,
        date: start,
        endDate: end,
        status: "PENDING",
        paymentStatus: "UNPAID",
        pricePaid: assignment.approvedSessionPrice,
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
      syncGoogleCalendarEvent(appt),
      sendAppointmentNotifications(appt, "Se creó una nueva cita en estado pendiente."),
    ]);

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");
    return { success: true, appointmentId: appt.id };
  } catch (e) {
    console.error("createAppointmentForPatient error:", e);
    return { success: false, error: "Error interno al agendar. Intenta nuevamente." };
  }
}
export async function cancelAppointmentByPatient(appointmentId, reason) {
  try {
    const session = await getSession();
    if (!session) return { error: "No autorizado: sesión requerida." };
    if (session.role !== "USER") return { error: "No autorizado." };

    const patientId = String(session.sub);
    const id = String(appointmentId || "");

    if (!id) return { error: "ID de cita inválido." };
    if (!reason || !String(reason).trim()) return { error: "Debes indicar el motivo de cancelación." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        service: true,
        patient: true,
      },
    });

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.patientId !== patientId) return { error: "No puedes cancelar citas de otros usuarios." };
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita no puede cancelarse (estado inválido)." };
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
  } catch (err) {
    console.error("cancelAppointmentByPatient error:", err);
    return { error: "Error interno al cancelar. Intenta nuevamente." };
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
              status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
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
    booked: appointment.professional.appointments.map((a) => ({
      startISO: a.date.toISOString(),
      endISO: a.endDate.toISOString(),
    })),
  };
}

export async function rescheduleAppointmentByPatient(appointmentId, newStartISO) {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const id = String(appointmentId || "");
  if (!id) return { error: "ID de cita inválido." };

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
  if (isNaN(newStart.getTime()) || newStart <= new Date()) {
    return { error: "Horario inválido." };
  }

  const durationMin = appointment.service?.durationMin ?? 60;
  const newEnd = new Date(newStart.getTime() + durationMin * 60000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      id: { not: id },
      professionalId: appointment.professionalId,
      status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
      date: { lt: newEnd },
      endDate: { gt: newStart },
    },
    select: { id: true },
  });

  if (conflict) return { error: "Ese horario ya está ocupado. Elige otro." };

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      date: newStart,
      endDate: newEnd,
      status: "PENDING",
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
    sendAppointmentNotifications(updated, "La cita fue reagendada por el paciente."),
  ]);

  revalidatePath("/panel/paciente");
  revalidatePath("/panel/profesional/citas");
  return { success: true };
}