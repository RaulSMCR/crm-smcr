// src/actions/agenda-actions.js
'use server';

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { emailCitaConfirmada } from "@/lib/email-templates";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getProIdOrThrow(session) {
  if (!session || session.role !== "PROFESSIONAL" || !session.professionalProfileId) {
    throw new Error("No autorizado.");
  }
  return String(session.professionalProfileId);
}

/**
 * Obtener citas del profesional (Pendientes y Confirmadas / Historial útil)
 * Devuelve una forma compatible con tu UI: { user, service, date, status }
 */
export async function getProfessionalAppointments(professionalId) {
  const session = await getSession();
  const proIdFromSession = getProIdOrThrow(session);

  // Si te pasan professionalId explícito, debe coincidir con la sesión
  const proId = professionalId ? String(professionalId) : proIdFromSession;
  if (proId !== proIdFromSession) {
    throw new Error("Acceso denegado: No puedes ver la agenda de otro profesional.");
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId: proId,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
      },
      include: {
        patient: { select: { name: true, email: true, phone: true } },
        service: { select: { title: true, price: true } },
      },
      orderBy: { date: "asc" },
    });

    // Adapter: tu UI espera apt.user, no apt.patient
    const data = appointments.map((a) => ({
      id: a.id,
      date: a.date,
      status: a.status,
      user: a.patient,
      service: a.service,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error al cargar agenda:", error);
    return { success: false, error: "Error al cargar la agenda." };
  }
}

/**
 * Server Action usada por ProfessionalAppointmentsPanel:
 * permite estados: CONFIRMED | COMPLETED | NO_SHOW | CANCELLED_BY_PRO
 */
export async function updateAppointmentStatus(appointmentId, newStatus) {
  const session = await getSession();
  const proId = getProIdOrThrow(session);

  const allowed = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED_BY_PRO"]);
  if (!allowed.has(String(newStatus))) {
    return { success: false, error: "Estado inválido." };
  }

  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: String(appointmentId) },
      select: { professionalId: true },
    });

    if (!appt || appt.professionalId !== proId) {
      return { success: false, error: "No tienes permiso para gestionar esta cita." };
    }

    const updated = await prisma.appointment.update({
      where: { id: String(appointmentId) },
      data: { status: String(newStatus) },
      include: {
        patient: { select: { name: true, email: true } },
        professional: { include: { user: { select: { name: true } } } },
      },
    });

    // Email solo cuando se confirma
    if (updated.status === "CONFIRMED" && process.env.RESEND_API_KEY) {
      try {
        const fechaLegible = format(updated.date, "EEEE d 'de' MMMM", { locale: es });
        const horaLegible = format(updated.date, "HH:mm");

        await resend.emails.send({
          from: "Salud Mental Costa Rica <citas@saludmentalcostarica.com>",
          to: updated.patient.email,
          subject: "✅ Tu cita ha sido confirmada",
          html: emailCitaConfirmada(
            updated.patient.name,
            updated.professional.user.name,
            fechaLegible,
            horaLegible
          ),
        });
      } catch (emailError) {
        console.error("Error enviando email de confirmación (No bloqueante):", emailError);
      }
    }

    revalidatePath("/panel/profesional");
    return { success: true };
  } catch (error) {
    console.error("Error updating appointment:", error);
    return { success: false, error: "Error interno al procesar la solicitud." };
  }
}

/** Compatibilidad retro: tu código viejo llamaba respondAppointment(action) */
export async function respondAppointment(appointmentId, action) {
  const act = String(action || "");
  const newStatus = act === "CONFIRM" ? "CONFIRMED" : "CANCELLED_BY_PRO";
  return updateAppointmentStatus(appointmentId, newStatus);
}
