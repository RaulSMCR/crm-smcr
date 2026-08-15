// src/lib/casos.js
// El caso: un proceso de atención entre un paciente y un profesional.
//
// Se abre solo, con la primera cita, y se cierra con alta o con baja. El cierre
// no queda en firme hasta que la dirección clínica lo visa, y eso está declarado
// en el acuerdo que el paciente acepta antes de empezar: el Código de Ética y
// Deontológico del CPPCR admite compartir con autorización expresa de la persona
// usuaria (art. 33) y exige que el consentimiento informado advierta los límites
// del secreto profesional. Sin ese aviso previo, esta supervisión no sería
// legítima; por eso el texto de /terminos y este módulo se sostienen mutuamente.
//
// Dos reglas que no se negocian:
//
//   Una nota de cierre visada no se edita. Se corrige con una adenda fechada.
//   Un expediente no se borra antes de diez años de concluido el servicio.
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
 * Si había un caso cerrado, el nuevo lo apunta como anterior. Un expediente
 * cerrado no se reabre: se retoma con uno nuevo, encadenado al viejo.
 */
export async function abrirCasoSiNoExiste({ patientId, professionalId, motivoConsulta = null }) {
  try {
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
    if (enCurso) return enCurso;

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
        motivoConsulta,
        estado: ESTADOS.ABIERTO,
        casoAnteriorId: anterior?.id || null,
        eventos: {
          create: {
            tipo: anterior ? EVENTOS.REAPERTURA : EVENTOS.APERTURA,
            detalle: anterior
              ? "Retoma del proceso: se abrió un caso nuevo encadenado al anterior."
              : "Caso abierto con la primera cita.",
          },
        },
      },
      select: { id: true },
    });

    return caso;
  } catch (error) {
    console.error("abrirCasoSiNoExiste error:", error);
    return null;
  }
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
