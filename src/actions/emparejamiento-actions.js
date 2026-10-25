"use server";

// src/actions/emparejamiento-actions.js
// Admin → Pacientes: emparejar paciente y profesional sin cita de por medio.
// Solo la administración lo hace; el profesional no ve pacientes ajenos.

import { revalidatePath } from "next/cache";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ESTADOS, emparejarPacienteConProfesional, retirarEmparejamiento } from "@/lib/casos";
import { pacientesEnElCalendario } from "@/lib/calendario-pacientes";
import { ETIQUETA_PERIODICIDAD } from "@/lib/acuerdos-de-atencion";

async function soloAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado." };
  if (isPreviewSession(session)) return { error: PREVIEW_BLOCKED_MESSAGE };
  return { session };
}

function revalidar() {
  revalidatePath("/panel/admin/pacientes");
  revalidatePath("/panel/profesional/casos");
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/paciente");
}

export async function retirarEmparejamientoComoAdmin(patientId, professionalId) {
  const { error } = await soloAdmin();
  if (error) return { success: false, error };
  try {
    const r = await retirarEmparejamiento({ patientId, professionalId });
    if (!r.ok) return { success: false, error: r.error };
    revalidar();
    return { success: true };
  } catch (fallo) {
    console.error("retirarEmparejamientoComoAdmin error:", fallo);
    return { success: false, error: "No se pudo retirar el emparejamiento." };
  }
}

/**
 * Pacientes registrados que aparecen como invitados en el Google Calendar de
 * algún profesional y todavía no están emparejados con él.
 */
export async function sugerenciasDesdeCalendarios() {
  const { error } = await soloAdmin();
  if (error) return { success: false, error };

  try {
    const profesionales = await prisma.professionalProfile.findMany({
      where: { isApproved: true, user: { isActive: true }, googleRefreshToken: { not: null } },
      select: { id: true, user: { select: { name: true } } },
    });

    const sugerencias = [];
    const sinRespuesta = [];
    for (const pro of profesionales) {
      let encontrados;
      try {
        encontrados = await pacientesEnElCalendario(prisma, pro.id);
      } catch (fallo) {
        console.error("sugerenciasDesdeCalendarios google:", fallo?.message);
        sinRespuesta.push(pro.user?.name || "Profesional");
        continue;
      }
      if (!encontrados?.length) continue;

      const emparejados = await prisma.caso.findMany({
        where: {
          professionalId: pro.id,
          patientId: { in: encontrados.map((e) => e.patientId) },
          estado: { in: [ESTADOS.ABIERTO, ESTADOS.PENDIENTE_VISADO] },
        },
        select: { patientId: true },
      });
      const yaEstan = new Set(emparejados.map((c) => c.patientId));

      for (const e of encontrados) {
        if (yaEstan.has(e.patientId)) continue;
        const serie = e.eventos.find((ev) => ev.recurrente);
        sugerencias.push({
          patientId: e.patientId,
          patientName: e.name,
          email: e.email,
          professionalId: pro.id,
          professionalName: pro.user?.name || "Profesional",
          resumen: serie
            ? `Serie en su calendario${serie.periodicidad ? ` (${ETIQUETA_PERIODICIDAD[serie.periodicidad].toLowerCase()})` : ""}`
            : `${e.eventos.length} evento(s) en su calendario`,
        });
      }
    }
    return { success: true, sugerencias, sinRespuesta, revisados: profesionales.length };
  } catch (fallo) {
    console.error("sugerenciasDesdeCalendarios error:", fallo);
    return { success: false, error: "No se pudieron revisar los calendarios." };
  }
}

export async function emparejarComoAdmin(patientId, professionalId) {
  const { session, error } = await soloAdmin();
  if (error) return { success: false, error };

  try {
    const r = await emparejarPacienteConProfesional({
      patientId,
      professionalId,
      actorId: String(session.sub || "") || null,
      quien: "administración",
    });
    if (!r.ok) return { success: false, error: r.error };
    revalidar();
    return { success: true, nuevo: r.nuevo };
  } catch (fallo) {
    console.error("emparejarComoAdmin error:", fallo);
    return { success: false, error: "No se pudo emparejar." };
  }
}
