"use server";

// src/actions/payment-actions.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createSession } from "@/lib/placetopay/client";
import { v4 as uuidv4 } from "uuid";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildReference(appointmentId, type) {
  // Max 32 chars para PlacetoPay
  const prefix = type === "DEPOSIT_50" ? "DEP" : type === "BALANCE_50" ? "BAL" : "FUL";
  return `${prefix}-${appointmentId}`.slice(0, 32);
}

function roundCRC(amount) {
  // PlacetoPay CRC no acepta decimales
  return Math.round(Number(amount));
}

// ─────────────────────────────────────────────
// 1. Iniciar pago de depósito (50% primera cita)
// ─────────────────────────────────────────────

/**
 * Inicia la sesión de pago del depósito del 50% para la primera cita.
 * Solo aplica cuando appointment.isFirstWithProfessional === true.
 *
 * @param {string} appointmentId
 * @param {{ ipAddress?: string, userAgent?: string }} options
 * @returns {{ success: boolean, processUrl?: string, requestId?: number, error?: string }}
 */
export async function initiateDepositPayment(appointmentId, { ipAddress, userAgent } = {}) {
  try {
    const session = await getSession();
    if (!session || session.role !== "USER") {
      return { success: false, error: "Debes iniciar sesión como paciente." };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: String(appointmentId) },
      include: {
        service: { select: { title: true } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.patientId !== session.sub) return { success: false, error: "No autorizado." };
    if (!appointment.isFirstWithProfessional) {
      return { success: false, error: "Esta cita no requiere depósito anticipado." };
    }
    if (appointment.paymentStatus !== "UNPAID") {
      return { success: false, error: "Ya existe un pago registrado para esta cita." };
    }
    if (!appointment.pricePaid || Number(appointment.pricePaid) <= 0) {
      return { success: false, error: "El precio de la cita no está definido." };
    }

    // Verificar que no haya ya una transacción PENDING/PROCESSING/APPROVED de depósito
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        appointmentId,
        type: "DEPOSIT_50",
        status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
      },
    });
    if (existing) {
      if (existing.status === "APPROVED") {
        return { success: false, error: "El depósito ya fue aprobado." };
      }
      // Devolver URL existente si aún está activa
      if (existing.p2pProcessUrl) {
        return { success: true, processUrl: existing.p2pProcessUrl, requestId: existing.p2pRequestId };
      }
    }

    const depositAmount = roundCRC(Number(appointment.pricePaid) * 0.5);
    const reference = buildReference(appointmentId, "DEPOSIT_50");
    const proName = appointment.professional?.user?.name || "el profesional";
    const serviceTitle = appointment.service?.title || "Consulta";

    // Crear registro de transacción
    const transaction = await prisma.paymentTransaction.create({
      data: {
        appointmentId,
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        type: "DEPOSIT_50",
        amount: depositAmount,
        currency: "CRC",
        p2pReference: reference,
        status: "PENDING",
      },
    });

    // Llamar a PlacetoPay
    let p2pResult;
    try {
      p2pResult = await createSession({
        reference,
        description: `Depósito 50% - ${serviceTitle} con ${proName}`,
        amount: depositAmount,
        currency: "CRC",
        returnUrl: `${APP_URL}/panel/paciente/pago/resultado?ref=${reference}`,
        notifyUrl: `${APP_URL}/api/payment/webhook`,
        ipAddress: ipAddress || "127.0.0.1",
        userAgent: userAgent || "Mozilla/5.0",
      });
    } catch (p2pError) {
      // Revertir transacción a REJECTED si P2P falla
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "REJECTED", p2pStatusMessage: p2pError.message },
      });
      return { success: false, error: "No se pudo iniciar la sesión de pago. Intenta nuevamente." };
    }

    // Actualizar transacción con datos de P2P
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        p2pRequestId: p2pResult.requestId,
        p2pProcessUrl: p2pResult.processUrl,
        status: "PROCESSING",
      },
    });

    revalidatePath("/panel/paciente");

    return {
      success: true,
      processUrl: p2pResult.processUrl,
      requestId: p2pResult.requestId,
    };
  } catch (error) {
    console.error("[payment] initiateDepositPayment error:", error);
    return { success: false, error: "Error interno al procesar el pago." };
  }
}

// ─────────────────────────────────────────────
// 2. Iniciar pago de saldo (50% o 100% post-cita)
// ─────────────────────────────────────────────

/**
 * Inicia el pago del saldo restante una vez completada la cita.
 * - Primera cita: cobra el 50% restante (BALANCE_50)
 * - Citas subsecuentes: cobra el 100% (FULL_100)
 *
 * @param {string} appointmentId
 * @param {{ ipAddress?: string, userAgent?: string }} options
 */
export async function initiateBalancePayment(appointmentId, { ipAddress, userAgent } = {}) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "USER" && session.role !== "ADMIN")) {
      return { success: false, error: "No autorizado." };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: String(appointmentId) },
      include: {
        service: { select: { title: true } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) return { success: false, error: "Cita no encontrada." };
    if (appointment.status !== "COMPLETED") {
      return { success: false, error: "Solo se puede cobrar el saldo de citas completadas." };
    }
    if (appointment.paymentStatus === "PAID") {
      return { success: false, error: "Esta cita ya fue pagada en su totalidad." };
    }
    if (!appointment.pricePaid || Number(appointment.pricePaid) <= 0) {
      return { success: false, error: "El precio de la cita no está definido." };
    }

    const isFirst = appointment.isFirstWithProfessional;
    const txType = isFirst ? "BALANCE_50" : "FULL_100";
    const balanceAmount = isFirst
      ? roundCRC(Number(appointment.pricePaid) * 0.5)
      : roundCRC(Number(appointment.pricePaid));

    // Verificar que no haya transacción activa del mismo tipo
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        appointmentId,
        type: txType,
        status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
      },
    });
    if (existing) {
      if (existing.status === "APPROVED") {
        return { success: false, error: "El pago ya fue aprobado." };
      }
      if (existing.p2pProcessUrl) {
        return { success: true, processUrl: existing.p2pProcessUrl, requestId: existing.p2pRequestId };
      }
    }

    const reference = buildReference(appointmentId, txType);
    const proName = appointment.professional?.user?.name || "el profesional";
    const serviceTitle = appointment.service?.title || "Consulta";
    const desc = isFirst
      ? `Saldo 50% - ${serviceTitle} con ${proName}`
      : `Pago completo - ${serviceTitle} con ${proName}`;

    const transaction = await prisma.paymentTransaction.create({
      data: {
        appointmentId,
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        type: txType,
        amount: balanceAmount,
        currency: "CRC",
        p2pReference: reference,
        status: "PENDING",
      },
    });

    let p2pResult;
    try {
      p2pResult = await createSession({
        reference,
        description: desc,
        amount: balanceAmount,
        currency: "CRC",
        returnUrl: `${APP_URL}/panel/paciente/pago/resultado?ref=${reference}`,
        notifyUrl: `${APP_URL}/api/payment/webhook`,
        ipAddress: ipAddress || "127.0.0.1",
        userAgent: userAgent || "Mozilla/5.0",
      });
    } catch (p2pError) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "REJECTED", p2pStatusMessage: p2pError.message },
      });
      return { success: false, error: "No se pudo iniciar la sesión de pago. Intenta nuevamente." };
    }

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        p2pRequestId: p2pResult.requestId,
        p2pProcessUrl: p2pResult.processUrl,
        status: "PROCESSING",
      },
    });

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/admin/citas");

    return {
      success: true,
      processUrl: p2pResult.processUrl,
      requestId: p2pResult.requestId,
    };
  } catch (error) {
    console.error("[payment] initiateBalancePayment error:", error);
    return { success: false, error: "Error interno al procesar el pago." };
  }
}

// ─────────────────────────────────────────────
// 3. Crear sesión de pago de saldo automáticamente (uso interno)
// ─────────────────────────────────────────────

/**
 * Genera la sesión de pago de saldo cuando una cita es marcada COMPLETED.
 * No verifica sesión de usuario — solo para uso interno desde server actions.
 * Es idempotente: si ya existe transacción activa, no crea una nueva.
 */
export async function createBalancePaymentAuto(appointmentId) {
  try {
    const id = String(appointmentId);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        service: { select: { title: true } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    if (!appointment) return;
    if (appointment.paymentStatus === "PAID") return;
    if (!appointment.pricePaid || Number(appointment.pricePaid) <= 0) return;

    const isFirst = appointment.isFirstWithProfessional;
    const txType = isFirst ? "BALANCE_50" : "FULL_100";
    const balanceAmount = isFirst
      ? roundCRC(Number(appointment.pricePaid) * 0.5)
      : roundCRC(Number(appointment.pricePaid));

    // Idempotencia: no duplicar si ya existe transacción activa
    const existing = await prisma.paymentTransaction.findFirst({
      where: {
        appointmentId: id,
        type: txType,
        status: { in: ["PENDING", "PROCESSING", "APPROVED"] },
      },
    });
    if (existing) return;

    const reference = buildReference(id, txType);
    const proName = appointment.professional?.user?.name || "el profesional";
    const serviceTitle = appointment.service?.title || "Consulta";
    const desc = isFirst
      ? `Saldo 50% - ${serviceTitle} con ${proName}`
      : `Pago completo - ${serviceTitle} con ${proName}`;

    const transaction = await prisma.paymentTransaction.create({
      data: {
        appointmentId: id,
        professionalId: appointment.professionalId,
        patientId: appointment.patientId,
        type: txType,
        amount: balanceAmount,
        currency: "CRC",
        p2pReference: reference,
        status: "PENDING",
      },
    });

    const p2pResult = await createSession({
      reference,
      description: desc,
      amount: balanceAmount,
      currency: "CRC",
      returnUrl: `${APP_URL}/panel/paciente/pago/resultado?ref=${reference}`,
      notifyUrl: `${APP_URL}/api/payment/webhook`,
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
    });

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        p2pRequestId: p2pResult.requestId,
        p2pProcessUrl: p2pResult.processUrl,
        status: "PROCESSING",
      },
    });

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/admin/citas");
  } catch (error) {
    console.error("[payment] createBalancePaymentAuto error:", error);
    // Fire-and-forget: no re-throw
  }
}

// ─────────────────────────────────────────────
// 4. Consultar transacciones de una cita (auditoría)
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
        p2pReference: true,
        p2pRequestId: true,
        p2pStatusCode: true,
        p2pStatusMessage: true,
        p2pPaymentDate: true,
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

