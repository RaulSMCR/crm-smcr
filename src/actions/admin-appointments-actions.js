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
      service: { select: { title: true, price: true } },
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
