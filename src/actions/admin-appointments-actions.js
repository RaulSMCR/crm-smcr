"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";

const ADMIN_ALLOWED_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED_BY_USER",
  "CANCELLED_BY_PRO",
]);

const CANCEL_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

export async function getAdminAppointments({ status } = {}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  return prisma.appointment.findMany({
    where: status ? { status } : undefined,
    include: {
      patient: { select: { name: true, email: true } },
      professional: {
        select: {
          id: true,
          googleRefreshToken: true,
          user: { select: { name: true, email: true } },
        },
      },
      service: { select: { title: true, price: true, durationMin: true } },
    },
    orderBy: { date: "desc" },
  });
}

export async function adminUpdateAppointmentStatus(appointmentId, nextStatus, cancelReason) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const id = String(appointmentId || "");
  const status = String(nextStatus || "");
  const reason = String(cancelReason || "").trim();

  if (!id || !ADMIN_ALLOWED_STATUSES.has(status)) {
    return { success: false, error: "Datos inválidos." };
  }

  if (CANCEL_STATUSES.has(status) && !reason) {
    return { success: false, error: "El motivo de cancelación es obligatorio." };
  }

  const cancelData = CANCEL_STATUSES.has(status)
    ? { cancelReason: reason, canceledBy: "ADMIN", canceledAt: new Date() }
    : { cancelReason: null, canceledBy: null, canceledAt: null };

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status, ...cancelData },
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
    syncGoogleCalendarEvent(appointment),
    sendAppointmentNotifications(appointment, `El administrador actualizó el estado a ${status}.`),
  ]);

  revalidatePath("/panel/admin/citas");
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/paciente");

  return { success: true };
}

export async function adminRescheduleAppointment(appointmentId, newDatetime) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const id = String(appointmentId || "");
  if (!id || !newDatetime) {
    return { success: false, error: "Datos inválidos." };
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        select: {
          id: true,
          googleRefreshToken: true,
          user: { select: { name: true, email: true } },
        },
      },
      patient: { select: { name: true, email: true } },
    },
  });

  if (!existing) return { success: false, error: "Cita no encontrada." };

  const durationMin = existing.service?.durationMin ?? 60;
  const newStart = new Date(newDatetime);
  const newEnd = new Date(newStart.getTime() + durationMin * 60000);

  if (isNaN(newStart.getTime())) {
    return { success: false, error: "Fecha inválida." };
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      professionalId: existing.professionalId,
      id: { not: id },
      status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
      date: { lt: newEnd },
      endDate: { gt: newStart },
    },
  });

  if (conflict) {
    return { success: false, error: "Conflicto: ya existe una cita en ese horario para este profesional." };
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { date: newStart, endDate: newEnd },
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
    sendAppointmentNotifications(updated, "El administrador reagendó la cita."),
  ]);

  revalidatePath("/panel/admin/citas");
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/paciente");

  return { success: true };
}
