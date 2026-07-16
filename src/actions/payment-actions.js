"use server";

// src/actions/payment-actions.js
// Acciones de pago con ONVO Costa Rica (payment links).
//
// Flujo vigente:
//   1. Primera cita paciente-profesional: adelanto 50% al crear la cita.
//   2. Al marcar esa primera cita como COMPLETED: saldo 50%.
//   3. Citas posteriores con el mismo profesional: postpago 100%.
//   4. ONVO confirma via webhook en /api/payment/webhook.

import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { requireProfessionalProfileId } from "@/lib/auth-guards";
import { revalidatePath } from "next/cache";
import {
  createPaymentRequestForAppointment,
  paymentRequestMessage,
} from "@/lib/payment-requests";

function getCompletionPaymentType(appointment) {
  if (appointment.isFirstWithProfessional) {
    return appointment.paymentStatus === "PARTIALLY_PAID" ? "BALANCE_50" : "DEPOSIT_50";
  }

  return "FULL_100";
}

async function assertProfessionalCanAccessAppointment(session, appointment) {
  if (session.role !== "PROFESSIONAL") return true;

  let proProfileId = session.professionalProfileId || null;
  if (!proProfileId) {
    try {
      proProfileId = await requireProfessionalProfileId();
    } catch {
      proProfileId = null;
    }
  }

  return Boolean(proProfileId && appointment.professionalId === proProfileId);
}

function paymentErrorMessage(paymentRequest) {
  if (paymentRequest?.code === "MISSING_ONVO_LINK") {
    return "El profesional no tiene un enlace de pago ONVO configurado. Contacte al administrador.";
  }

  if (paymentRequest?.code === "MISSING_AMOUNT") {
    return "No se pudo determinar el monto de la cita. Verifique que el servicio tenga precio aprobado.";
  }

  return paymentRequest?.error || "No se pudo generar el cobro.";
}

/**
 * Envia o reenvia el enlace de pago ONVO al paciente cuando la cita esta
 * completada. Para primeras citas, respeta adelanto/saldo 50%.
 */
export async function cobrarCita(appointmentId) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSIONAL" && session.role !== "ADMIN")) {
      return { success: false, error: "No autorizado." };
    }
    if (isPreviewSession(session)) {
      return { success: false, error: PREVIEW_BLOCKED_MESSAGE };
    }

    const id = String(appointmentId || "");
    if (!id) return { success: false, error: "ID de cita invalido." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { title: true } },
        patient: { select: { name: true, email: true } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };

    if (!(await assertProfessionalCanAccessAppointment(session, appointment))) {
      return { success: false, error: "No autorizado." };
    }

    if (appointment.status !== "COMPLETED") {
      return { success: false, error: "Solo se puede cobrar citas completadas." };
    }
    if (appointment.paymentStatus === "PAID") {
      return { success: false, error: "Esta cita ya esta pagada." };
    }

    const txType = getCompletionPaymentType(appointment);
    const paymentRequest = await createPaymentRequestForAppointment(appointment, txType);

    if (!paymentRequest.success) {
      return { success: false, error: paymentErrorMessage(paymentRequest) };
    }

    revalidatePath("/panel/profesional/citas");
    revalidatePath("/panel/admin/citas");
    revalidatePath("/panel/paciente");

    return { success: true, message: paymentRequestMessage(paymentRequest) };
  } catch (error) {
    console.error("[payment] cobrarCita error:", error);
    return { success: false, error: "Error interno al procesar el cobro." };
  }
}

/**
 * Envia automaticamente el enlace de pago ONVO cuando una cita se marca como
 * COMPLETED. Es idempotente: si hay una transaccion activa, la reenvia.
 */
export async function sendPaymentLinkOnCompletion(appointmentId) {
  try {
    const id = String(appointmentId || "");
    if (!id) return null;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { title: true } },
        patient: { select: { name: true, email: true } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) {
      console.error(`[payment] sendPaymentLinkOnCompletion: cita ${id} no encontrada.`);
      return null;
    }

    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "PROFESSIONAL")) {
      console.warn(`[payment] sendPaymentLinkOnCompletion: sesion no autorizada para cita ${id}.`);
      return null;
    }
    if (isPreviewSession(session)) {
      console.warn(`[payment] sendPaymentLinkOnCompletion: bloqueado en modo ver-como para cita ${id}.`);
      return null;
    }
    if (!(await assertProfessionalCanAccessAppointment(session, appointment))) {
      console.warn(`[payment] sendPaymentLinkOnCompletion: profesional ajeno a cita ${id}.`);
      return null;
    }

    if (appointment.paymentStatus === "PAID") {
      console.log(`[payment] sendPaymentLinkOnCompletion: cita ${id} ya esta PAID.`);
      return null;
    }

    const txType = getCompletionPaymentType(appointment);
    const paymentRequest = await createPaymentRequestForAppointment(appointment, txType);

    if (!paymentRequest.success) {
      console.error(
        `[payment] sendPaymentLinkOnCompletion: ${paymentErrorMessage(paymentRequest)} cita ${id}.`
      );
      return null;
    }

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/admin/citas");
    revalidatePath("/panel/profesional/citas");

    console.log(`[payment] sendPaymentLinkOnCompletion: ${paymentRequestMessage(paymentRequest)} cita ${id}.`);
    return {
      paymentUrl: paymentRequest.paymentUrl,
      amount: paymentRequest.amount,
      type: paymentRequest.type,
    };
  } catch (error) {
    console.error("[payment] sendPaymentLinkOnCompletion error:", error);
    return null;
  }
}

/**
 * Devuelve todas las transacciones de pago de una cita.
 * Acceso: ADMIN o el propio paciente.
 */
export async function getPaymentTransactions(appointmentId) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "No autenticado." };

    const appointment = await prisma.appointment.findUnique({
      where: { id: String(appointmentId) },
      select: { patientId: true },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };

    const isAdmin = session.role === "ADMIN";
    const isOwner = appointment.patientId === session.sub || appointment.patientId === session.userId;
    if (!isAdmin && !isOwner) return { success: false, error: "No autorizado." };

    const transactions = await prisma.paymentTransaction.findMany({
      where: { appointmentId: String(appointmentId) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        onvoPaymentLinkId: true,
        onvoEventId: true,
        statusMessage: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, transactions };
  } catch (error) {
    console.error("[payment] getPaymentTransactions error:", error);
    return { success: false, error: "Error consultando transacciones." };
  }
}
