// src/actions/scheduling-block-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  enlaceWhatsApp,
  etiquetaBloqueo,
  restituirAgendamiento,
} from "@/lib/scheduling-block";

/**
 * Pacientes con la agenda en pausa, con todo lo necesario para contactarlos.
 *
 * Devuelve también el enlace de WhatsApp ya armado: la pausa solo se levanta
 * después de hablar con la persona, así que la lista sirve de poco si desde ahí
 * no se puede escribir.
 */
export async function listarAgendasEnPausa() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado.", pacientes: [] };

  const pacientes = await prisma.user.findMany({
    where: { schedulingBlockedAt: { not: null } },
    orderBy: { schedulingBlockedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      schedulingBlockedAt: true,
      schedulingBlockedReason: true,
      appointments: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          date: true,
          professionalId: true,
          professional: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";

  return {
    pacientes: pacientes.map((p) => {
      const ultima = p.appointments[0];
      const urlAgenda = ultima?.professionalId ? `${base}/agendar/${ultima.professionalId}` : "";
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        bloqueadoDesde: p.schedulingBlockedAt,
        motivo: etiquetaBloqueo(p.schedulingBlockedReason),
        profesional: ultima?.professional?.user?.name || null,
        ultimaCita: ultima?.date || null,
        urlAgenda,
        whatsapp: enlaceWhatsApp({ telefono: p.phone, urlAgenda }),
      };
    }),
  };
}

/**
 * Devuelve al paciente la capacidad de agendar.
 *
 * Se ejecuta después de haberlo contactado, no antes: el orden es lo que hace
 * que la pausa sirva de algo.
 */
export async function restituirAgendaDePaciente(patientId) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado." };

  const id = String(patientId || "");
  if (!id) return { error: "Paciente inválido." };

  try {
    await restituirAgendamiento(id);
    revalidatePath("/panel/admin/agendas-en-pausa");
    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (error) {
    console.error("restituirAgendaDePaciente error:", error);
    return { error: "No se pudo restituir el acceso." };
  }
}

/**
 * El paciente pide que la administración lo contacte.
 *
 * Se ofrece solo la primera vez que le pasa. No es un trámite: es la puerta que
 * se le deja abierta a alguien que probablemente nunca antes llevó un proceso
 * con un profesional de salud mental, y que ante un cobro y una agenda cerrada
 * lo más fácil sería abandonar. A la segunda ya conoce la regla y el contacto
 * sale de la administración.
 */
export async function solicitarContactoDeAdmin() {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const patientId = String(session.sub);

  const [paciente, sanciones] = await Promise.all([
    prisma.user.findUnique({
      where: { id: patientId },
      select: { name: true, email: true, phone: true, schedulingBlockedAt: true },
    }),
    prisma.appointment.count({
      where: { patientId, penaltyAppliedAt: { not: null } },
    }),
  ]);

  if (!paciente?.schedulingBlockedAt) return { error: "Tu agenda no está en pausa." };
  if (sanciones > 1) {
    return { error: "Ya tenemos tu solicitud. La administración se comunica con vos." };
  }

  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (to && process.env.RESEND_API_KEY) {
    const { resend } = await import("@/lib/resend");
    await resend.emails
      .send({
        from: process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>",
        to,
        subject: `🙋 ${paciente.name} pide que lo contacten`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
          <h2 style="color:#047857;">Un paciente pidió que lo contacten</h2>
          <p>Es la <strong>primera vez</strong> que le pasa. Levantó la mano en lugar de
             abandonar, que es exactamente lo que se buscaba.</p>
          <p><strong>${paciente.name}</strong><br>${paciente.phone || "sin teléfono"} ·
             ${paciente.email}</p>
          <p style="font-size:13px;color:#475569;">Está en
             <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/panel/admin/agendas-en-pausa">
             agendas en pausa</a>, con el enlace de WhatsApp listo.</p>
        </div>`,
      })
      .catch((e) => console.error("[agenda] No se pudo avisar la solicitud:", e));
  }

  return { success: true };
}
