import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { drainDeliveries, DeliveryError } from "@/lib/delivery-jobs";
import { sendPaymentConfirmationEmail } from "@/lib/onvo/payment-mail";
import { sendFeEmail, submitInvoiceToFe } from "@/lib/fe/submit";
import { FE_EMISOR } from "@/lib/fe/config";

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
    if (result.reviewRequired || result.feStatus === "REJECTED" || String(result.feErrorMessage || "").includes("SIMULADO")) {
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

export async function processPaymentDeliveries(options = {}) {
  const first = await drainDeliveries(prisma, executePaymentDelivery, options);
  // Al tramitar una factura concreta puede haberse creado su correo de entrega.
  if (options.invoiceId) {
    const second = await drainDeliveries(prisma, executePaymentDelivery, options);
    return { processed: first.processed + second.processed, pending: first.pending + second.pending, review: first.review + second.review };
  }
  return first;
}
