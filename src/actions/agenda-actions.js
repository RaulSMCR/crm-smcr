// src/actions/agenda-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";

function toStr(x) {
  if (x === undefined || x === null) return "";
  return String(x);
}

async function requireProfessionalProfileId() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado: sesión requerida.");

  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") throw new Error("No autorizado: rol PROFESSIONAL requerido.");

  const profId = toStr(session.professionalProfileId);
  if (!profId) throw new Error("No se encontró professionalProfileId en la sesión.");

  return profId;
}

// Estados permitidos para acciones desde panel profesional (UI)
const ALLOWED_PRO_STATUS = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED_BY_PRO"]);

export async function updateAppointmentStatus(appointmentId, newStatus) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(appointmentId);
    const status = toStr(newStatus);

    if (!id) return { success: false, error: "ID inválido." };
    if (!ALLOWED_PRO_STATUS.has(status)) {
      return { success: false, error: `Estado no permitido: ${status}` };
    }

    const appt = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, professionalId: true, status: true },
    });

    if (!appt) return { success: false, error: "Cita no encontrada." };
    if (appt.professionalId !== professionalId) {
      return { success: false, error: "No puedes modificar citas de otro profesional." };
    }

    // Transiciones mínimas coherentes (evita saltos raros)
    // PENDING -> CONFIRMED
    // CONFIRMED -> COMPLETED | NO_SHOW
    // (opcional) PENDING/CONFIRMED -> CANCELLED_BY_PRO
    const from = appt.status;

    const okTransition =
      (from === "PENDING" && (status === "CONFIRMED" || status === "CANCELLED_BY_PRO")) ||
      (from === "CONFIRMED" &&
        (status === "COMPLETED" || status === "NO_SHOW" || status === "CANCELLED_BY_PRO"));

    if (!okTransition) {
      return { success: false, error: `Transición inválida: ${from} → ${status}` };
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
    ]);

    // Refrescar vistas relevantes
    revalidatePath("/panel/profesional/citas");
    revalidatePath("/panel/profesional"); // dashboard muestra próximos turnos
    revalidatePath("/panel/paciente");
    revalidatePath("/admin/appointments");

    return { success: true };
  } catch (err) {
    console.error("Error updateAppointmentStatus:", err);
    return { success: false, error: "Error interno al actualizar cita." };
  }
}
