// src/lib/casos.js
// El registro administrativo de un proceso de atención.
//
// Acá no hay expediente clínico y no debe haberlo. El expediente le pertenece a
// la persona y a su profesional, y conservarlo diez años es obligación del
// profesional colegiado (CPPCR, arts. 21 y 22). La plataforma se ocupa de la
// parte administrativa: cuándo empezó un proceso, cuándo terminó y con qué
// categoría.
//
// El proceso se abre solo, con la primera cita, y se cierra con alta o con baja.
// El cierre pasa por la dirección clínica antes de quedar en firme, pero eso es
// un control del negocio —protege a la empresa y al profesional de un cierre mal
// documentado—, no supervisión de la práctica: con quién y cada cuánto supervisa
// lo decide cada profesional.
//
// Las reglas puras viven en lib/casos-policy, para que las puedan usar los
// componentes cliente sin arrastrar Prisma al navegador. Se reexportan acá
// porque, del lado del servidor, pensar en un solo módulo es más simple.

import { prisma } from "@/lib/prisma";
import { ESTADOS, EVENTOS } from "@/lib/casos-policy";

export {
  ANIOS_CONSERVACION,
  ESTADOS,
  EVENTOS,
  RESULTADOS,
  TIPOS_CIERRE,
  estadoParaPaciente,
  fechaDeConservacion,
  sePuedeDepurar,
  validarCierre,
} from "@/lib/casos-policy";

/**
 * Abre el caso si esta pareja paciente–profesional no tiene uno en curso.
 *
 * Se llama desde los tres caminos que crean citas, así el profesional nunca
 * tiene que abrir nada a mano. Es idempotente y nunca lanza: si falla, la cita
 * igual tiene que quedar reservada.
 *
 * Si había un caso cerrado, el nuevo lo apunta como anterior. Un registro
 * cerrado no se reabre: se retoma con uno nuevo, encadenado al viejo.
 */
export async function abrirCasoSiNoExiste({ patientId, professionalId }) {
  try {
    const r = await abrirCaso({ patientId, professionalId });
    return r?.caso || null;
  } catch (error) {
    console.error("abrirCasoSiNoExiste error:", error);
    return null;
  }
}

/**
 * Filtro Prisma de los pacientes que un profesional puede ver: los que tienen
 * cita o caso con él. El resto de los usuarios solo los ve la administración.
 */
export function wherePacientesDelProfesional(professionalId) {
  const proId = String(professionalId || "");
  return {
    role: "USER",
    isActive: true,
    OR: [
      { appointments: { some: { professionalId: proId } } },
      { casosComoPaciente: { some: { professionalId: proId } } },
    ],
  };
}

export async function esPacienteDelProfesional(patientId, professionalId) {
  const encontrado = await prisma.user.findFirst({
    where: { id: String(patientId || ""), ...wherePacientesDelProfesional(professionalId) },
    select: { id: true },
  });
  return Boolean(encontrado);
}

/**
 * Empareja a mano a un paciente con un profesional, sin cita de por medio.
 *
 * Es para quien llegó por fuera del flujo de reserva: un paciente de antes que
 * se registró solo para recibir su factura, alguien que pidió por WhatsApp que
 * lo agenden. Un paciente puede estar emparejado con varios profesionales a la
 * vez; lo que no se duplica es el caso en curso de una misma pareja.
 *
 * @returns {Promise<{ok: true, nuevo: boolean} | {ok: false, error: string}>}
 */
export async function emparejarPacienteConProfesional({ patientId, professionalId, actorId = null, quien = "" }) {
  const pid = String(patientId || "");
  const proId = String(professionalId || "");
  if (!pid || !proId) return { ok: false, error: "Elegí paciente y profesional." };

  const [paciente, profesional] = await Promise.all([
    prisma.user.findUnique({ where: { id: pid }, select: { role: true, isActive: true } }),
    prisma.professionalProfile.findUnique({
      where: { id: proId },
      select: { isApproved: true, user: { select: { isActive: true } } },
    }),
  ]);
  if (!paciente || paciente.role !== "USER" || !paciente.isActive) {
    return { ok: false, error: "Ese paciente no existe o su cuenta no está activa." };
  }
  if (!profesional?.isApproved || !profesional.user?.isActive) {
    return { ok: false, error: "Ese profesional no está activo en el equipo." };
  }

  const r = await abrirCaso({
    patientId: pid,
    professionalId: proId,
    actorId,
    detalle: `Emparejamiento manual${quien ? ` (${quien})` : ""}, sin cita previa.`,
  });
  if (!r) return { ok: false, error: "No se pudo emparejar." };
  return { ok: true, nuevo: r.nuevo };
}

/**
 * Deshace un emparejamiento que nunca llegó a atención.
 *
 * Si la pareja ya tiene citas o un acuerdo, el caso es registro administrativo
 * que se conserva diez años: no se borra, se cierra con alta o baja.
 *
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function retirarEmparejamiento({ patientId, professionalId }) {
  const pid = String(patientId || "");
  const proId = String(professionalId || "");
  if (!pid || !proId) return { ok: false, error: "Emparejamiento inválido." };

  const [citas, acuerdos, casos] = await Promise.all([
    prisma.appointment.count({ where: { patientId: pid, professionalId: proId } }),
    prisma.acuerdoDeAtencion.count({ where: { patientId: pid, professionalId: proId } }),
    prisma.caso.findMany({
      where: { patientId: pid, professionalId: proId, estado: { in: [ESTADOS.ABIERTO, ESTADOS.PENDIENTE_VISADO] } },
      select: { id: true, _count: { select: { notas: true } } },
    }),
  ]);

  if (casos.length === 0) return { ok: false, error: "No están emparejados." };
  if (citas > 0 || acuerdos > 0 || casos.some((c) => c._count.notas > 0)) {
    return {
      ok: false,
      error:
        "Ya hubo atención con este profesional, así que el registro se conserva. " +
        "Para terminarlo, el profesional propone el cierre (alta o baja) desde Casos.",
    };
  }

  const ids = casos.map((c) => c.id);
  await prisma.$transaction([
    prisma.casoEvento.deleteMany({ where: { casoId: { in: ids } } }),
    prisma.caso.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return { ok: true };
}

async function abrirCaso({ patientId, professionalId, actorId = null, detalle = null }) {
  const pid = String(patientId || "");
  const proId = String(professionalId || "");
  if (!pid || !proId) return null;

  const enCurso = await prisma.caso.findFirst({
    where: {
      patientId: pid,
      professionalId: proId,
      estado: { in: [ESTADOS.ABIERTO, ESTADOS.PENDIENTE_VISADO] },
    },
    select: { id: true },
  });
  if (enCurso) return { caso: enCurso, nuevo: false };

  const paciente = await prisma.user.findUnique({
    where: { id: pid },
    select: { name: true, identification: true },
  });
  if (!paciente) return null;

  // El último cerrado que todavía no tenga sucesor: la cadena no se bifurca.
  const anterior = await prisma.caso.findFirst({
    where: {
      patientId: pid,
      professionalId: proId,
      estado: ESTADOS.CERRADO,
      casoSiguiente: { is: null },
    },
    orderBy: { cerradoAt: "desc" },
    select: { id: true },
  });

  const caso = await prisma.caso.create({
    data: {
      patientId: pid,
      professionalId: proId,
      pacienteNombre: String(paciente.name || "").slice(0, 120),
      pacienteCedula: paciente.identification || null,
      estado: ESTADOS.ABIERTO,
      casoAnteriorId: anterior?.id || null,
      eventos: {
        create: {
          tipo: anterior ? EVENTOS.REAPERTURA : EVENTOS.APERTURA,
          actorId,
          detalle:
            detalle ||
            (anterior
              ? "Retoma del proceso: se abrió un caso nuevo encadenado al anterior."
              : "Caso abierto con la primera cita."),
        },
      },
    },
    select: { id: true },
  });

  return { caso, nuevo: true };
}

/**
 * ¿Hay un cierre esperando visado con este profesional?
 *
 * Mientras la dirección clínica no resuelva, el paciente no reserva por su
 * cuenta con esa persona: el profesional ya dio el proceso por terminado y una
 * cita nueva lo contradiría antes de que nadie lo haya revisado.
 *
 * Solo aplica a los caminos que inicia el paciente. El profesional sí puede
 * agendar: a veces lo que falta justamente es una sesión de cierre.
 *
 * @returns {Promise<null | {error: string, errorCode: string}>}
 */
export async function bloqueoPorCierreEnCurso(patientId, professionalId) {
  try {
    const enVisado = await prisma.caso.findFirst({
      where: {
        patientId: String(patientId),
        professionalId: String(professionalId),
        estado: ESTADOS.PENDIENTE_VISADO,
      },
      select: { id: true },
    });
    if (!enVisado) return null;

    return {
      error:
        "Tu proceso con este profesional está en revisión. Escribinos y coordinamos cómo seguir: " +
        "puede ser con la misma persona o con otra del equipo.",
      errorCode: "CIERRE_EN_REVISION",
    };
  } catch (error) {
    console.error("bloqueoPorCierreEnCurso error:", error);
    return null;
  }
}

/** Anota algo en la bitácora del caso. Nunca lanza. */
export async function anotarEvento(casoId, tipo, { actorId = null, detalle = null } = {}) {
  try {
    await prisma.casoEvento.create({
      data: { casoId: String(casoId), tipo, actorId, detalle },
    });
  } catch (error) {
    console.error("anotarEvento error:", error);
  }
}
