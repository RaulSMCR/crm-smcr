"use server";

// src/actions/payment-actions.js
// Acciones de pago con ONVO Costa Rica (enlaces de pago / payment links).
//
// Flujo:
//   1. Admin asigna el ID de enlace ONVO al profesional (panel de admin).
//   2. Al marcar la cita como COMPLETADA, el profesional (o el sistema)
//      invoca cobrarCita(), que envía el enlace al paciente por email.
//   3. El paciente paga en checkout.onvopay.com.
//   4. ONVO notifica vía webhook → /api/payment/webhook actualiza el estado.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildPaymentLinkUrl } from "@/lib/onvo/client";
import { sendPaymentRequestEmail } from "@/lib/appointments";

// ─────────────────────────────────────────────
// 1. Cobrar cita (acción del profesional)
// ─────────────────────────────────────────────

/**
 * Envía el enlace de pago ONVO al paciente cuando la cita está completada.
 *
 * - Busca el onvoPaymentLinkId del profesional (configurado por el admin).
 * - Crea/reutiliza la PaymentTransaction con status LINK_SENT.
 * - Envía email al paciente con el enlace de pago.
 *
 * Requiere sesión PROFESSIONAL o ADMIN.
 *
 * @param {string} appointmentId
 */
export async function cobrarCita(appointmentId) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSIONAL" && session.role !== "ADMIN")) {
      return { success: false, error: "No autorizado." };
    }

    const id = String(appointmentId || "");
    if (!id) return { success: false, error: "ID de cita inválido." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { title: true } },
        patient: { select: { name: true, email: true } },
        professional: {
          select: {
            onvoPaymentLinkId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.status !== "COMPLETED") {
      return { success: false, error: "Solo se puede cobrar citas completadas." };
    }
    if (appointment.paymentStatus === "PAID") {
      return { success: false, error: "Esta cita ya está pagada." };
    }

    const onvoLinkId = appointment.professional?.onvoPaymentLinkId;
    if (!onvoLinkId) {
      return {
        success: false,
        error: "El profesional no tiene un enlace de pago ONVO configurado. Contacte al administrador.",
      };
    }

    const paymentUrl = buildPaymentLinkUrl(onvoLinkId);
    const proName = appointment.professional?.user?.name || "el profesional";
    const serviceTitle = appointment.service?.title || "Consulta";
    const amount = appointment.pricePaid ? Number(appointment.pricePaid) : 0;

    // Idempotencia: si ya existe una transacción activa, reenviar el email
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        appointmentId: id,
        status: { in: ["PENDING", "LINK_SENT"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await sendPaymentRequestEmail({
        patientName: appointment.patient?.name,
        patientEmail: appointment.patient?.email,
        processUrl: paymentUrl,
        amount,
        serviceTitle,
        proName,
        isFirst: appointment.isFirstWithProfessional,
      });

      return { success: true, message: "Enlace de pago reenviado al paciente por email." };
    }

    // Crear nueva transacción
    const txType = appointment.isFirstWithProfessional ? "FULL_100" : "FULL_100";
    const txAmount = amount > 0 ? amount : await resolvePriceForAppointment(appointment);

    if (!txAmount || txAmount <= 0) {
      return {
        success: false,
        error: "No se pudo determinar el monto de la cita. Verifique que el servicio tenga precio aprobado.",
      };
    }

    await prisma.paymentTransaction.create({
      data: {
        appointmentId: id,
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        type: txType,
        amount: txAmount,
        currency: "CRC",
        onvoPaymentLinkId: onvoLinkId,
        status: "LINK_SENT",
      },
    });

    await sendPaymentRequestEmail({
      patientName: appointment.patient?.name,
      patientEmail: appointment.patient?.email,
      processUrl: paymentUrl,
      amount: txAmount,
      serviceTitle,
      proName,
      isFirst: appointment.isFirstWithProfessional,
    });

    revalidatePath("/panel/profesional/citas");
    revalidatePath("/panel/admin/citas");

    return { success: true, message: "Enlace de pago enviado al paciente por email." };
  } catch (error) {
    console.error("[payment] cobrarCita error:", error);
    return { success: false, error: "Error interno al procesar el cobro." };
  }
}

// ─────────────────────────────────────────────
// 2. Envío automático al completar cita (uso interno)
// ─────────────────────────────────────────────

/**
 * Envía automáticamente el enlace de pago ONVO cuando una cita es marcada
 * como COMPLETADA. Llamar desde el server action que completa la cita.
 * Es idempotente: no duplica transacciones activas.
 *
 * @param {string} appointmentId
 * @returns {Promise<{ paymentUrl: string, amount: number } | null>}
 */
export async function sendPaymentLinkOnCompletion(appointmentId) {
  try {
    const id = String(appointmentId);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { title: true } },
        patient: { select: { name: true, email: true } },
        professional: {
          select: {
            onvoPaymentLinkId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!appointment) {
      console.error(`[payment] sendPaymentLinkOnCompletion: cita ${id} no encontrada.`);
      return null;
    }
    if (appointment.paymentStatus === "PAID") {
      console.log(`[payment] sendPaymentLinkOnCompletion: cita ${id} ya está PAID.`);
      return null;
    }

    const onvoLinkId = appointment.professional?.onvoPaymentLinkId;
    if (!onvoLinkId) {
      console.warn(`[payment] sendPaymentLinkOnCompletion: profesional sin onvoPaymentLinkId en cita ${id}.`);
      return null;
    }

    // Idempotencia: no crear nueva transacción si ya existe una activa
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        appointmentId: id,
        status: { in: ["PENDING", "LINK_SENT", "APPROVED"] },
      },
    });

    if (existing) {
      if (existing.status === "APPROVED") return null;
      console.log(`[payment] sendPaymentLinkOnCompletion: cita ${id} ya tiene transacción activa, reutilizando.`);
      const paymentUrl = buildPaymentLinkUrl(onvoLinkId);
      return { paymentUrl, amount: Number(existing.amount) };
    }

    const price = await resolvePriceForAppointment(appointment);
    if (!price || price <= 0) {
      console.error(`[payment] sendPaymentLinkOnCompletion: cita ${id} sin precio definido.`);
      return null;
    }

    const paymentUrl = buildPaymentLinkUrl(onvoLinkId);
    const proName = appointment.professional?.user?.name || "el profesional";
    const serviceTitle = appointment.service?.title || "Consulta";

    await prisma.paymentTransaction.create({
      data: {
        appointmentId: id,
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        type: "FULL_100",
        amount: price,
        currency: "CRC",
        onvoPaymentLinkId: onvoLinkId,
        status: "LINK_SENT",
      },
    });

    await sendPaymentRequestEmail({
      patientName: appointment.patient?.name,
      patientEmail: appointment.patient?.email,
      processUrl: paymentUrl,
      amount: price,
      serviceTitle,
      proName,
      isFirst: appointment.isFirstWithProfessional,
    });

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/admin/citas");

    console.log(`[payment] sendPaymentLinkOnCompletion: enlace enviado para cita ${id}.`);
    return { paymentUrl, amount: price };
  } catch (error) {
    console.error("[payment] sendPaymentLinkOnCompletion error:", error);
    return null;
  }
}

// ─────────────────────────────────────────────
// 3. Consultar transacciones de una cita (auditoría)
// ─────────────────────────────────────────────

/**
 * Devuelve todas las transacciones de pago de una cita.
 * Acceso: ADMIN o el propio paciente.
 *
 * @param {string} appointmentId
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
    const isOwner = appointment.patientId === session.sub;
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

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

async function resolvePriceForAppointment(appointment) {
  if (appointment.pricePaid && Number(appointment.pricePaid) > 0) {
    return Number(appointment.pricePaid);
  }

  if (appointment.serviceId || appointment.professionalId) {
    const assignment = await prisma.serviceAssignment
      .findUnique({
        where: {
          professionalId_serviceId: {
            professionalId: appointment.professionalId,
            serviceId: appointment.serviceId,
          },
        },
        select: { approvedSessionPrice: true },
      })
      .catch(() => null);

    const price = assignment?.approvedSessionPrice
      ? Number(assignment.approvedSessionPrice)
      : 0;

    if (price > 0) {
      await prisma.appointment
        .update({ where: { id: appointment.id }, data: { pricePaid: price } })
        .catch(() => {});
      return price;
    }
  }

  return 0;
}
