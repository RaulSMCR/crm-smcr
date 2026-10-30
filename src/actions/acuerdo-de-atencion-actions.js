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
import { marcarSeguroPalig } from "@/lib/seguro-palig";
import { esPacienteDelProfesional, wherePacientesDelProfesional } from "@/lib/casos";
import { pacientesEnElCalendario, proximaSesionDeSerie } from "@/lib/calendario-pacientes";
import { ESTADOS_ACUERDO } from "@/lib/acuerdos-de-atencion";

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
    if (!(await esPacienteDelProfesional(datos.patientId, ctx.professionalId))) {
      return { success: false, error: "Este paciente todavía no está emparejado con usted." };
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
      serieGoogleId: datos.serieGoogleId || null,
    });
    if (!resultado.ok) return { success: false, error: resultado.message };

    // Después de crear el acuerdo y no antes: si el alta falla, el paciente no
    // queda marcado con un seguro por un formulario que no se guardó.
    let seguroMarcado = null;
    if (datos.seguroPalig) {
      const marca = await marcarSeguroPalig(prisma, datos.patientId).catch(() => ({ ok: false }));
      seguroMarcado = marca.ok;
      revalidatePath("/panel/palig");
      revalidatePath("/panel/admin/seguros");
    }

    revalidarAgenda();
    return {
      success: true,
      seguroMarcado,
      creadas: resultado.creadas,
      omitidas: resultado.omitidas.map((d) => d.toISOString()),
      googlePublicado: Boolean(resultado.google?.publicado),
      serieAdoptada: Boolean(resultado.serieAdoptada),
    };
  } catch (error) {
    console.error("crearAcuerdoAction error:", error);
    return { success: false, error: "No se pudo crear el acuerdo. Inténtelo de nuevo." };
  }
}

/**
 * Series de Google de los pacientes de este profesional que todavía no tienen
 * acuerdo, para crearlo adoptando la serie. Crear el acuerdo es opcional: la
 * serie puede quedarse como está el tiempo que haga falta.
 */
export async function seriesDeGoogleParaAcuerdosAction() {
  try {
    const ctx = await contexto();
    if (ctx.error) return { success: false, error: ctx.error };

    let encontrados;
    try {
      encontrados = await pacientesEnElCalendario(prisma, ctx.professionalId);
    } catch (error) {
      console.error("seriesDeGoogleParaAcuerdosAction google:", error?.message);
      return { success: false, error: "Google no respondió. Inténtelo de nuevo en un rato." };
    }
    if (encontrados === null) return { success: false, error: "Su calendario de Google no está conectado." };

    const [propios, conAcuerdo] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: encontrados.map((e) => e.patientId) }, ...wherePacientesDelProfesional(ctx.professionalId) },
        select: { id: true },
      }),
      prisma.acuerdoDeAtencion.findMany({
        where: { professionalId: ctx.professionalId, estado: ESTADOS_ACUERDO.ACTIVO },
        select: { patientId: true, gcalEventId: true },
      }),
    ]);
    const suyos = new Set(propios.map((p) => p.id));
    const adoptadas = new Set(conAcuerdo.map((a) => a.gcalEventId).filter(Boolean));
    const pacientesConAcuerdo = new Set(conAcuerdo.map((a) => a.patientId));

    const series = [];
    for (const paciente of encontrados) {
      if (!suyos.has(paciente.patientId) || pacientesConAcuerdo.has(paciente.patientId)) continue;
      for (const evento of paciente.eventos) {
        if (!evento.recurrente || !evento.propio || !evento.periodicidad || adoptadas.has(evento.id)) continue;
        const proxima = await proximaSesionDeSerie(prisma, { professionalId: ctx.professionalId, serieId: evento.id });
        if (!proxima) continue;
        series.push({
          serieId: evento.id,
          titulo: evento.titulo,
          periodicidad: evento.periodicidad,
          proxima,
          patientId: paciente.patientId,
          patientName: paciente.name,
        });
      }
    }
    return { success: true, series };
  } catch (error) {
    console.error("seriesDeGoogleParaAcuerdosAction error:", error?.message);
    return { success: false, error: "No se pudo revisar el calendario." };
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
