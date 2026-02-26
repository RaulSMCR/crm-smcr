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

export async function adminUpdateAppointmentStatus(appointmentId, nextStatus) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const id = String(appointmentId || "");
  const status = String(nextStatus || "");

  if (!id || !ADMIN_ALLOWED_STATUSES.has(status)) {
    return { success: false, error: "Datos inválidos." };
  }

  const appointment = await prisma.appointment.update({
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
    syncGoogleCalendarEvent(appointment),
    sendAppointmentNotifications(appointment, `El administrador actualizó el estado a ${status}.`),
  ]);

  revalidatePath("/admin/appointments");
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/paciente");

  return { success: true };
}
