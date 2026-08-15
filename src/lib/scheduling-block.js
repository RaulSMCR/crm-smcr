// src/lib/scheduling-block.js
// Aplicación de la política de reagendado: multa, pausa y aviso.
//
// Dos caminos distintos llegan acá —el paciente que quiere mover la cita con
// menos de 24 horas, y el profesional que la marca como no asistida— y ambos
// tienen que producir exactamente lo mismo. Por eso vive en un solo lugar.
//
// El orden importa: primero se pausa la agenda, después se intenta el cobro.
// Si el cobro falla, la pausa ya quedó puesta y el administrador se entera por
// la alerta; al revés, un fallo del correo dejaría al paciente cobrado y
// agendando como si nada.

import { prisma } from "@/lib/prisma";
import { createPaymentRequestForAppointment } from "@/lib/payment-requests";
import { ETIQUETAS_BLOQUEO, montoMulta, saldoDeMulta } from "@/lib/rescheduling-policy";

/** Suma de lo ya cobrado y aprobado para una cita. */
async function totalPagado(appointmentId) {
  const pagos = await prisma.paymentTransaction.findMany({
    where: { appointmentId, status: "APPROVED" },
    select: { amount: true },
  });
  return pagos.reduce((suma, p) => suma + Number(p.amount || 0), 0);
}

/**
 * Aplica la multa y pausa el agendamiento del paciente.
 *
 * Idempotente por `penaltyAppliedAt`: volver a marcar el mismo no-show no cobra
 * dos veces.
 *
 * @returns {Promise<{aplicada: boolean, motivoOmision?: string, multa: number,
 *                    cobrada: number, cobroError?: string}>}
 */
export async function aplicarMultaYPausa(appointment, motivo) {
  if (appointment.penaltyAppliedAt) {
    return { aplicada: false, motivoOmision: "YA_APLICADA", multa: 0, cobrada: 0 };
  }

  const multa = montoMulta(appointment.pricePaid);
  const yaPagado = await totalPagado(appointment.id);
  // En una primera cita el adelanto ya ES el 50%: la multa queda cubierta con lo
  // retenido y cobrar de nuevo sería cobrar la cita entera sin haberla dado.
  const porCobrar = saldoDeMulta(appointment.pricePaid, yaPagado);

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { penaltyAppliedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: appointment.patientId },
      data: {
        schedulingBlockedAt: new Date(),
        schedulingBlockedReason: motivo,
        schedulingRestoredAt: null,
      },
    }),
  ]);

  let cobroError;
  if (porCobrar > 0) {
    const cobro = await createPaymentRequestForAppointment(appointment, "PENALTY_50");
    if (!cobro?.success) cobroError = cobro?.error || "No se pudo generar el cobro de la multa.";
  }

  return { aplicada: true, multa, cobrada: porCobrar, cobroError };
}

/**
 * Devuelve al paciente la capacidad de agendar.
 *
 * Es deliberadamente manual: la pausa existe para forzar una conversación, y
 * levantarla sola por el paso del tiempo la vaciaría de sentido.
 */
export async function restituirAgendamiento(patientId) {
  await prisma.user.update({
    where: { id: String(patientId) },
    data: {
      schedulingBlockedAt: null,
      schedulingBlockedReason: null,
      schedulingRestoredAt: new Date(),
    },
  });
}

/** ¿Tiene el paciente la agenda en pausa? */
export function estaBloqueado(user) {
  return Boolean(user?.schedulingBlockedAt);
}

/**
 * Enlace de WhatsApp con el mensaje ya escrito, para que el administrador
 * contacte al paciente sin tener que redactarlo cada vez.
 */
export function enlaceWhatsApp({ telefono, nombrePaciente, nombreProfesional, urlAgenda }) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (!digitos) return null;
  // Costa Rica: 8 dígitos locales, se antepone el código de país.
  const numero = digitos.length === 8 ? `506${digitos}` : digitos;

  const texto =
    `Hola ${nombrePaciente || ""}, le escribimos de Salud Mental Costa Rica. ` +
    `Ya puede volver a agendar su cita${nombreProfesional ? ` con ${nombreProfesional}` : ""}` +
    `${urlAgenda ? `: ${urlAgenda}` : "."}`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Texto legible del motivo, para la UI y los correos. */
export function etiquetaBloqueo(motivo) {
  return ETIQUETAS_BLOQUEO[motivo] || "Agenda en pausa";
}
