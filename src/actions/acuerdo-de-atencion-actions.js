"use server";

// src/actions/acuerdo-de-atencion-actions.js
// Alta y fin de los acuerdos de atención desde el panel del profesional. La
// lógica vive en src/lib/acuerdos-server.js; acá solo se resuelve quién pide y
// se traduce la fecha que llega del formulario.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { requireProfessionalProfileId } from "@/lib/auth-guards";
import { crearAcuerdo, terminarAcuerdo } from "@/lib/acuerdos-de-atencion-server";
import { instanteDeHoraCR } from "@/lib/appointment-slots";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function revalidarAgenda() {
  revalidatePath("/panel/profesional/citas");
  revalidatePath("/panel/profesional");
  revalidatePath("/panel/paciente");
}

async function contexto() {
  const session = await getSession();
  if (!session) return { error: "Sesión requerida." };
  // En «ver como» el administrador mira el panel ajeno: no publica invitaciones
  // ni crea citas en nombre del profesional.
  if (isPreviewSession(session)) return { error: PREVIEW_BLOCKED_MESSAGE };
  const professionalId = await requireProfessionalProfileId();
  return { professionalId, userId: String(session.userId || session.sub || "") || null };
}

/**
 * @param {object} datos
 * @param {string} datos.fecha  Día de la primera sesión, 'YYYY-MM-DD' en Costa Rica.
 * @param {string} datos.hora   Hora de la primera sesión, 'HH:MM' en Costa Rica.
 */
export async function crearAcuerdoAction(datos = {}) {
  try {
    const ctx = await contexto();
    if (ctx.error) return { success: false, error: ctx.error };

    const fecha = String(datos.fecha || "");
    const hora = String(datos.hora || "");
    if (!FECHA.test(fecha) || !HORA.test(hora)) {
      return { success: false, error: "Indique el día y la hora de la primera sesión." };
    }

    const resultado = await crearAcuerdo(prisma, {
      professionalId: ctx.professionalId,
      patientId: datos.patientId,
      serviceId: datos.serviceId,
      locationId: datos.locationId || null,
      periodicidad: datos.periodicidad,
      inicio: instanteDeHoraCR(fecha, hora),
      precioAcordado: datos.precioAcordado,
      notas: datos.notas,
      createdBy: ctx.userId,
    });
    if (!resultado.ok) return { success: false, error: resultado.message };

    revalidarAgenda();
    return {
      success: true,
      creadas: resultado.creadas,
      omitidas: resultado.omitidas.map((d) => d.toISOString()),
      googlePublicado: Boolean(resultado.google?.publicado),
    };
  } catch (error) {
    console.error("crearAcuerdoAction error:", error);
    return { success: false, error: "No se pudo crear el acuerdo. Inténtelo de nuevo." };
  }
}

export async function terminarAcuerdoAction(acuerdoId, motivo) {
  try {
    const ctx = await contexto();
    if (ctx.error) return { success: false, error: ctx.error };

    const acuerdo = await prisma.acuerdoDeAtencion.findUnique({
      where: { id: String(acuerdoId || "") },
      select: { professionalId: true },
    });
    if (!acuerdo || acuerdo.professionalId !== ctx.professionalId) {
      return { success: false, error: "El acuerdo no existe." };
    }

    const resultado = await terminarAcuerdo(prisma, String(acuerdoId), { motivo });
    if (!resultado.ok) return { success: false, error: resultado.message };

    revalidarAgenda();
    return { success: true, canceladas: resultado.canceladas, googleCortado: resultado.google.cortado };
  } catch (error) {
    console.error("terminarAcuerdoAction error:", error);
    return { success: false, error: "No se pudo terminar el acuerdo. Inténtelo de nuevo." };
  }
}
