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
