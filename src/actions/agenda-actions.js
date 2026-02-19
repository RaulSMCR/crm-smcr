// src/actions/agenda-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireProfessionalProfileId } from "@/lib/auth-guards";

/**
 * Actualiza estado de una cita perteneciente al profesional logueado.
 * Estados permitidos (según tu schema actual típico):
 * CONFIRMED | COMPLETED | NO_SHOW | CANCELLED_BY_PRO
 */
export async function updateAppointmentStatus(appointmentId, newStatus) {
  const professionalId = await requireProfessionalProfileId();

  const allowed = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED_BY_PRO"]);
  if (!allowed.has(String(newStatus))) {
    return { success: false, error: "Estado inválido." };
  }

  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: String(appointmentId) },
      select: { professionalId: true },
    });

    if (!appt || String(appt.professionalId) !== String(professionalId)) {
      return { success: false, error: "No tienes permiso para gestionar esta cita." };
    }

    await prisma.appointment.update({
      where: { id: String(appointmentId) },
      data: { status: String(newStatus) },
    });

    revalidatePath("/panel/profesional");
    revalidatePath("/panel/profesional/citas");
    return { success: true };
  } catch (err) {
    console.error("Error updateAppointmentStatus:", err);
    return { success: false, error: "Error interno al actualizar la cita." };
  }
}

/** Alias de compat por si quedó UI vieja */
export async function respondAppointment(appointmentId, action) {
  const act = String(action || "");
  const status = act === "CONFIRM" ? "CONFIRMED" : "CANCELLED_BY_PRO";
  return updateAppointmentStatus(appointmentId, status);
}
