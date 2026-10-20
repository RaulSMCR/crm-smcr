import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { drainDeliveries, DeliveryError } from "@/lib/delivery-jobs";
import { sendPaymentConfirmationEmail } from "@/lib/onvo/payment-mail";
import { sendFeEmail, submitInvoiceToFe } from "@/lib/fe/submit";
import { FE_EMISOR } from "@/lib/fe/config";
import { despertarColaDeEnvios } from "@/lib/qstash";

async function deliverMail(job, checkpoint, message) {
  if (!process.env.RESEND_API_KEY) throw new DeliveryError("MAIL_NOT_CONFIGURED");
  const hash = createHash("sha256").update(JSON.stringify(message)).digest("hex");
  await checkpoint.beforeSend(hash);
  const result = await resend.emails.send(message, { idempotencyKey: `smcr-delivery/${job.id}` });
  if (result.error) {
    const review = ["invalid_idempotent_request", "validation_error"].includes(result.error.name);
    throw new DeliveryError(review ? "MAIL_REQUEST_REVIEW" : "MAIL_PROVIDER_FAILED", review);
  }
  if (!result.data?.id) throw new DeliveryError("MAIL_RESULT_UNKNOWN");
  return { providerId: result.data.id };
}

export async function executePaymentDelivery(job, checkpoint) {
  if (job.kind === "FE_SUBMISSION") {
    const result = await submitInvoiceToFe(job.invoiceId);
    // Código propio para el rechazo: es un veredicto final de Hacienda, no algo
    // que una persona tenga que investigar, y lo que corresponde es reemitir.
    // Con el genérico FE_REQUIRES_REVIEW el panel no los distinguía.
    if (result.feStatus === "REJECTED") throw new DeliveryError("FE_RECHAZADA", true);
    if (result.reviewRequired || String(result.feErrorMessage || "").includes("SIMULADO")) {
      throw new DeliveryError("FE_REQUIRES_REVIEW", true);
    }
    if (result.feStatus !== "ACCEPTED") throw new DeliveryError("FE_AWAITING_CONFIRMATION");
    return {};
  }
  const deliver = (message) => deliverMail(job, checkpoint, message);
  if (job.kind === "PAYMENT_CONFIRMATION") {
    const transaction = await prisma.paymentTransaction.findUnique({ where: { id: job.paymentTransactionId }, select: {
      id: true, amount: true, currency: true, type: true, status: true,
      patient: { select: { email: true, name: true } },
      professional: { select: { user: { select: { name: true } } } },
      appointment: { select: {
        status: true, paymentStatus: true, date: true, pricePaid: true, modality: true,
        locationName: true, locationAddress: true, locationNotes: true,
        service: { select: { title: true } },
      } },
    } });
    if (!transaction || transaction.status !== "APPROVED") throw new DeliveryError("PAYMENT_CHANGED", true);
    if (transaction.appointment.paymentStatus === "REFUNDED" || transaction.type !== "PENALTY_50" && transaction.appointment.status.startsWith("CANCELLED")) {
      throw new DeliveryError("APPOINTMENT_CHANGED", true);
    }
    return sendPaymentConfirmationEmail(transaction, deliver);
  }
  if (job.kind === "FE_RECEIPT") {
    const invoice = await prisma.invoice.findUnique({ where: { id: job.invoiceId }, include: {
      contact: { select: { email: true, billingEmail: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    } });
    const allowedRejected = FE_EMISOR.ambiente === "02" && invoice?.feStatus === "REJECTED";
    if (!invoice?.feXml || !invoice.feNumber || !["OPEN", "PAID"].includes(invoice.status) ||
        invoice.feStatus !== "ACCEPTED" && !allowedRejected || String(invoice.feErrorMessage || "").includes("SIMULADO")) {
      throw new DeliveryError("FE_RECEIPT_NOT_READY", true);
    }
    return sendFeEmail(invoice, { deliver });
  }
  throw new DeliveryError("JOB_KIND_UNKNOWN", true);
}

/**
 * Programa el próximo despertar de la cola para cuando venza la tarea más
 * próxima. Ver `despertarColaDeEnvios` en lib/qstash.js.
 *
 * Mira dos cosas: la tarea PENDING que vence primero, y la PROCESSING cuyo
 * candado expira primero (una función que murió a mitad de camino deja la
 * tarea tomada hasta que vence el candado, y recién ahí se puede recuperar).
 * Si no hay ninguna, no programa nada: la cadena se apaga sola.
 *
 * Nunca lanza.
 */
export async function programarProximaRevision(db = prisma) {
  try {
    const [pendiente, tomada] = await Promise.all([
      db.deliveryJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { nextAttemptAt: "asc" },
        select: { nextAttemptAt: true },
      }),
      db.deliveryJob.findFirst({
        where: { status: "PROCESSING", lockedUntil: { not: null } },
        orderBy: { lockedUntil: "asc" },
        select: { lockedUntil: true },
      }),
    ]);
    const vencimientos = [pendiente?.nextAttemptAt, tomada?.lockedUntil]
      .filter(Boolean)
      .map((fecha) => new Date(fecha).getTime());
    if (!vencimientos.length) return { programado: false, motivo: "COLA_VACIA" };
    return await despertarColaDeEnvios(Math.min(...vencimientos));
  } catch {
    console.error("[deliveries] WAKEUP_SCHEDULING_FAILED");
    return { programado: false, motivo: "ERROR" };
  }
}

/**
 * @param {{ invoiceId?: string, limit?: number, programar?: boolean }} [options]
 *   `programar: false` lo usa el worker para no reprogramar en cada una de sus
 *   rondas internas; programa una sola vez al final.
 */
export async function processPaymentDeliveries(options = {}) {
  const { programar = true, ...drainOptions } = options;
  const first = await drainDeliveries(prisma, executePaymentDelivery, drainOptions);
  let result = first;
  // Al tramitar una factura concreta puede haberse creado su correo de entrega.
  if (drainOptions.invoiceId) {
    const second = await drainDeliveries(prisma, executePaymentDelivery, drainOptions);
    result = { processed: first.processed + second.processed, pending: first.pending + second.pending, review: first.review + second.review };
  }
  if (programar) await programarProximaRevision();
  return result;
}
