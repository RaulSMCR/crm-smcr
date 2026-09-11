// src/app/api/payment/webhook/route.js
// Webhook de ONVO Pay — ruta pública verificada por secreto compartido.
//
// ONVO envía un POST cuando cambia el estado de un cobro. Siempre respondemos
// 200 para eventos atendidos. Los avisos no autenticados o malformados se
// rechazan sin efectos; los errores de procesamiento reciben una respuesta genérica.
//
// Configuración en el dashboard de ONVO:
//   URL:     https://{dominio}/api/payment/webhook
//   Secreto: el mismo valor que ONVO_WEBHOOK_SECRET
//
// El evento llega como { type, data } — sin `id` de nivel superior — y el estado
// del cobro está en `data.paymentStatus`. La traducción vive en
// @/lib/onvo/event, validada contra un evento real (ver tests/unit/onvo-event.test.js).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOnvoWebhookSecret } from "@/lib/onvo/webhook";
import { buildPaymentLinkUrl } from "@/lib/onvo/client";
import { normalizeOnvoEvent } from "@/lib/onvo/event";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";
import { processOnvoPayment } from "@/lib/onvo/process-payment";
import { sendAdminPaymentAlert } from "@/lib/onvo/payment-alert";
import { logOnvoWebhook } from "@/lib/onvo/observability";
import { resend } from "@/lib/resend";
import { sendInsuranceProSignAlert } from "@/lib/insurance-mail";
import { obtenerTipoCambio } from "@/lib/exchange-rate";
import { reportDepositConversion } from "@/lib/analytics/reportDepositConversion";
import { sendPurchaseMeta } from "@/lib/analytics/meta-events";
import { after } from "next/server";

export const dynamic = "force-dynamic";

const ONVO_WEBHOOK_SECRET = process.env.ONVO_WEBHOOK_SECRET;

const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

/**
 * POST /api/payment/webhook
 * Recibe notificaciones de pago de ONVO Pay.
 */
export async function POST(request) {
  // Autenticar antes de leer el cuerpo, acceder a datos o enviar notificaciones.
  if (!ONVO_WEBHOOK_SECRET) {
    logOnvoWebhook("error", "AUTH_CONFIG_MISSING");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const secretHeader = request.headers.get("x-webhook-secret") || "";
  const isValid = verifyOnvoWebhookSecret(secretHeader, ONVO_WEBHOOK_SECRET);
  if (!isValid) {
    logOnvoWebhook("warn", "AUTH_REJECTED");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const trace = {};
  try {
    return await processAuthenticatedWebhook(request, trace);
  } catch (error) {
    logOnvoWebhook("error", "PROCESSING_FAILED", { ...trace, error });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function processAuthenticatedWebhook(request, trace) {
  let payload;
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
      throw new Error("Invalid event shape");
    }
  } catch {
    logOnvoWebhook("warn", "BODY_INVALID");
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  // ── 2. Extraer datos del evento ──────────────────────────────────────────
  // El mapeo vive en @/lib/onvo/event y está validado contra un evento real:
  // ONVO no manda un `id` de nivel superior y el estado del pago está en
  // `data.paymentStatus`, no en `data.status`.
  const evento = normalizeOnvoEvent(payload);
  const {
    eventId,
    onvoLinkId,
    amount: eventAmount,
    currency: eventCurrency,
  } = evento;

  Object.assign(trace, { eventId, onvoLinkId });
  // La evidencia autenticada de conciliación queda en la BD; no se duplica
  // en logs con correos, datos del cliente, cabeceras o contenido del evento.
  logOnvoWebhook("info", "RECEIVED", { eventId, onvoLinkId, status: evento.resultado });

  if (!eventId) {
    logOnvoWebhook("warn", "EVENT_ID_MISSING");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Resolver el tipo de cambio antes de abrir la transacción. Las llamadas a
  // proveedores no deben mantener bloqueos en la base de datos.
  const { rate } = evento.resultado === "aprobado" ? await obtenerTipoCambio() : {};
  const result = await processOnvoPayment(prisma, evento, payload, { usdCrcRate: rate });
  if (result.kind === "duplicate") {
    logOnvoWebhook("info", "ALREADY_PROCESSED", { eventId });
    return NextResponse.json({ ok: true });
  }
  if (result.kind === "unmatched") {
    logOnvoWebhook("warn", "UNMATCHED", { eventId, onvoLinkId, reason: result.reasonCode });
    await sendAdminPaymentAlert({
      subject: `⚠ Pago ONVO no conciliado (${result.reasonCode})`,
      reason: result.reason, eventId, onvoLinkId, amount: eventAmount, currency: eventCurrency,
    }).catch((error) => logOnvoWebhook("error", "UNMATCHED_ALERT_FAILED", { eventId, error }));
    return NextResponse.json({ ok: true });
  }

  // Los datos financieros ya quedaron confirmados juntos. Solo quien realizó
  // esa transición dispara notificaciones; un reenvío no las repite.
  const processedTransaction = result.transaction;
  if (processedTransaction.status === "APPROVED") {
    const { invoiceId, nextPaymentStatus } = result;
    logOnvoWebhook("info", "APPOINTMENT_PAYMENT_UPDATED", {
      eventId, transactionId: processedTransaction.id,
      appointmentId: processedTransaction.appointmentId, status: nextPaymentStatus,
    });
    logOnvoWebhook("info", "AUTO_INVOICE_CREATED", { transactionId: processedTransaction.id, invoiceId });
    if (result.fiscalWarning) {
      await sendAdminPaymentAlert({
        subject: "⚠ Servicio sin CABYS/IVA configurado",
        reason: "Servicio sin CABYS/IVA configurado: revisar antes de enviar a Hacienda",
        eventId, onvoLinkId, amount: processedTransaction.amount, currency: processedTransaction.currency, paymentRecorded: true,
      }).catch((error) => logOnvoWebhook("error", "FISCAL_ALERT_FAILED", { eventId, error }));
    }
    after(() => processPaymentDeliveries({ invoiceId }).catch((error) =>
      logOnvoWebhook("error", "DELIVERY_DISPATCH_FAILED", { invoiceId, error })
    ));
    if (processedTransaction.type === "DEPOSIT_50") {
      after(() => reportDepositConversion(processedTransaction.id).catch((error) =>
        logOnvoWebhook("error", "DEPOSIT_CONVERSION_FAILED", { transactionId: processedTransaction.id, error })
      ));
      after(() => sendPurchaseMeta(processedTransaction.id));
    }
    if (nextPaymentStatus === "PAID") {
      after(() => handleInsuranceClaim(processedTransaction, processedTransaction.paidAt).catch((error) =>
        logOnvoWebhook("error", "INSURANCE_CLAIM_FAILED", { transactionId: processedTransaction.id, error })
      ));
    }
  } else if (processedTransaction.status === "REJECTED") {
    await sendPaymentFailedEmail(processedTransaction).catch((error) =>
      logOnvoWebhook("error", "PAYMENT_FAILED_EMAIL_FAILED", { transactionId: processedTransaction.id, error })
    );
  }
  return NextResponse.json({ ok: true });
}

// ── Emails ───────────────────────────────────────────────────────────────────

// ── Reclamo de seguro ────────────────────────────────────────────────────────

async function handleInsuranceClaim(transaction, paidAt) {
  const patient = transaction.patient;
  if (!patient?.hasInsurance || !patient?.useInsuranceForPayment) return;

  const appointmentId = transaction.appointmentId;
  const professionalId = transaction.professionalId;
  const templateUrl = patient.insuranceTemplateUrl || null;
  const claimStatus = templateUrl ? "PENDING_SIGNED_FORM" : "AWAITING_TEMPLATE";

  const claim = await prisma.insuranceClaim.upsert({
    where: { appointmentId },
    create: {
      patientId: transaction.patientId,
      appointmentId,
      professionalId,
      paymentDate: paidAt,
      status: claimStatus,
    },
    update: {
      paymentDate: paidAt,
      status: claimStatus,
    },
  });

  logOnvoWebhook("info", "INSURANCE_CLAIM_UPDATED", { claimId: claim.id, status: claimStatus });

  if (claimStatus === "PENDING_SIGNED_FORM") {
    const proEmail = transaction.professional?.user?.email;
    if (proEmail) {
      await sendInsuranceProSignAlert({
        proEmail,
        patientName: patient.name,
        insuranceName: patient.insuranceName,
        paymentDate: paidAt,
        templateUrl,
      }).catch((error) => logOnvoWebhook("error", "INSURANCE_ALERT_FAILED", { claimId: claim.id, error }));
    }
  }
}

async function sendPaymentFailedEmail(transaction) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const onvoLinkId = transaction.onvoPaymentLinkId;
  const retryUrl = onvoLinkId
    ? buildPaymentLinkUrl(onvoLinkId)
    : process.env.APP_URL || "http://localhost:3000";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2>Pago no procesado</h2>
      <p>Estimado/a <strong>${patientName}</strong>, el pago no pudo ser procesado.</p>
      <p>Puede intentarlo nuevamente haciendo clic en el siguiente enlace:</p>
      <p>
        <a href="${retryUrl}"
           style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Reintentar pago
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;">Este correo fue generado automáticamente.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: patientEmail,
    subject: "No fue posible procesar el pago — Salud Mental Costa Rica",
    html,
  });

  if (error) logOnvoWebhook("error", "PAYMENT_FAILED_EMAIL_FAILED", { transactionId: transaction.id, error });
}
