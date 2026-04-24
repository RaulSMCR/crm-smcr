// src/app/api/payment/webhook/route.js
// Webhook de ONVO Pay — ruta pública verificada por firma HMAC-SHA256.
//
// ONVO envía una notificación POST cuando cambia el estado de un pago.
// Siempre respondemos 200 para evitar que ONVO reintente la notificación.
//
// Configurar en el dashboard de ONVO:
//   URL: https://{tu-dominio}/api/payment/webhook
//   Secret: (generar y guardar en ONVO_WEBHOOK_SECRET)
//
// Payload esperado de ONVO (estructura Stripe-like):
//   {
//     "id": "evt_xxx",               ← ID único del evento
//     "type": "payment.completed",   ← Tipo de evento
//     "data": {
//       "payment_link_id": "live_xxx",
//       "amount": 45500,
//       "currency": "crc",
//       "status": "approved",
//       "customer": { "email": "..." }
//     }
//   }
//
// Nota: verificar el formato exacto del payload en https://docs.onvopay.com/webhooks

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOnvoWebhook } from "@/lib/onvo/webhook";
import { resend } from "@/lib/resend";
import { submitInvoiceToFe } from "@/lib/fe/submit";

export const dynamic = "force-dynamic";

const ONVO_WEBHOOK_SECRET = process.env.ONVO_WEBHOOK_SECRET;
const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

/**
 * POST /api/payment/webhook
 * Recibe notificaciones de pago de ONVO Pay.
 */
export async function POST(request) {
  let rawBody;
  let payload;

  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[ONVO webhook] Body JSON inválido.");
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 200 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const signatureHeader = request.headers.get("onvo-signature") || "";

  console.log("[ONVO webhook] Recibido desde IP:", ip, "| evento:", payload?.id, "| tipo:", payload?.type);

  // ── 1. Verificar firma ───────────────────────────────────────────────────
  if (!ONVO_WEBHOOK_SECRET) {
    console.error("[ONVO webhook] ONVO_WEBHOOK_SECRET no configurada.");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const isValid = verifyOnvoWebhook(rawBody, signatureHeader, ONVO_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("[ONVO webhook] Firma inválida. Descartando notificación.");
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 200 });
  }

  // ── 2. Extraer datos del evento ──────────────────────────────────────────
  const eventId = payload?.id;
  const eventType = payload?.type;
  const data = payload?.data || {};
  const onvoLinkId = data?.payment_link_id;
  const onvoStatus = data?.status || "";
  const paidAt = data?.paid_at ? new Date(data.paid_at) : new Date();

  if (!eventId) {
    console.warn("[ONVO webhook] Evento sin ID, ignorando.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 3. Idempotencia: ignorar eventos ya procesados ───────────────────────
  const alreadyProcessed = await prisma.paymentTransaction.findFirst({
    where: { onvoEventId: eventId },
  });
  if (alreadyProcessed) {
    console.log("[ONVO webhook] Evento ya procesado:", eventId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 4. Buscar la transacción activa para este enlace de pago ─────────────
  // Buscamos la transacción más reciente en estado LINK_SENT para el enlace ONVO.
  // Dado que el enlace es compartido, tomamos la más reciente no pagada.
  let transaction = null;
  if (onvoLinkId) {
    transaction = await prisma.paymentTransaction.findFirst({
      where: {
        onvoPaymentLinkId: onvoLinkId,
        status: { in: ["PENDING", "LINK_SENT"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        appointment: {
          select: {
            id: true,
            paymentStatus: true,
            service: { select: { title: true } },
          },
        },
        patient: { select: { name: true, email: true, identification: true } },
        professional: { select: { user: { select: { name: true, email: true } } } },
      },
    });
  }

  if (!transaction) {
    console.warn("[ONVO webhook] Transacción no encontrada para enlace:", onvoLinkId, "| evento:", eventId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 5. Mapear estado ONVO → estado interno ───────────────────────────────
  const statusMap = {
    approved:  "APPROVED",
    completed: "APPROVED",
    rejected:  "REJECTED",
    failed:    "REJECTED",
    pending:   "LINK_SENT",
  };
  const newStatus = statusMap[onvoStatus.toLowerCase()] || "LINK_SENT";

  // ── 6. Actualizar la transacción ─────────────────────────────────────────
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      onvoEventId:   eventId,
      status:        newStatus,
      statusMessage: `ONVO: ${eventType || onvoStatus}`,
      paidAt:        newStatus === "APPROVED" ? paidAt : null,
      webhookPayload: payload,
    },
  });

  // ── 7. Si el pago fue aprobado: actualizar cita + crear factura + email ──
  if (newStatus === "APPROVED") {
    await prisma.appointment.update({
      where: { id: transaction.appointmentId },
      data: { paymentStatus: "PAID" },
    });

    console.log(`[ONVO webhook] Cita ${transaction.appointmentId} → paymentStatus: PAID`);

    const [invoiceResult] = await Promise.allSettled([
      createAutoInvoice(transaction),
      sendPaymentConfirmationEmail(transaction),
    ]);

    const invoiceId = invoiceResult.status === "fulfilled" ? invoiceResult.value : null;
    if (invoiceId) {
      submitInvoiceToFe(invoiceId).catch((e) =>
        console.error("[ONVO webhook] Error en submitInvoiceToFe:", e)
      );
    }
  } else if (newStatus === "REJECTED") {
    await sendPaymentFailedEmail(transaction);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── Facturación automática ───────────────────────────────────────────────────

async function createAutoInvoice(transaction) {
  try {
    const amount = Number(transaction.amount);
    if (!amount || amount <= 0) return null;

    const serviceTitle = transaction.appointment?.service?.title || "Consulta";
    const now = new Date();

    let finalInvoiceId = null;

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: `AUTO-${Date.now()}`,
          invoiceType: "CUSTOMER_INVOICE",
          status: "DRAFT",
          contactId: transaction.patientId,
          appointmentId: transaction.appointmentId,
          professionalId: transaction.professionalId,
          contactName:     transaction.patient?.name || null,
          contactIdNumber: transaction.patient?.identification || null,
          paymentMethod:   "transfer",
          invoiceDate: now,
          dueDate: now,
          subtotal: amount,
          taxAmount: 0,
          discountAmount: 0,
          total: amount,
          amountPaid: 0,
          balance: amount,
          currency: transaction.currency || "CRC",
          notes: `ONVO Pay | Enlace: ${transaction.onvoPaymentLinkId || "-"} | Evento: ${transaction.onvoEventId || "-"}`,
          lines: {
            create: {
              productName: `Pago completo – ${serviceTitle}`,
              description: serviceTitle,
              quantity: 1,
              unitPrice: amount,
              discountPercent: 0,
              taxRate: 0,
              taxAmount: 0,
              lineSubtotal: amount,
              lineTotal: amount,
              sortOrder: 0,
            },
          },
        },
      });

      const sequence = await tx.invoiceSequence.upsert({
        where: { sequenceType: "CUSTOMER_INVOICE" },
        update: { currentNumber: { increment: 1 }, year: now.getFullYear() },
        create: {
          sequenceType: "CUSTOMER_INVOICE",
          currentNumber: 1,
          year: now.getFullYear(),
          prefix: "",
          padding: 4,
        },
      });

      const padded = String(sequence.currentNumber).padStart(sequence.padding || 4, "0");
      const invoiceNumber = `${sequence.prefix || ""}${padded}`;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber,
          status: "PAID",
          amountPaid: amount,
          balance: 0,
          paymentDate: now,
        },
      });

      finalInvoiceId = invoice.id;
    });

    console.log(`[ONVO webhook] Factura auto-creada para transacción ${transaction.id}`);
    return finalInvoiceId;
  } catch (err) {
    console.error("[ONVO webhook] Error en createAutoInvoice:", err);
    return null;
  }
}

// ── Emails ───────────────────────────────────────────────────────────────────

async function sendPaymentConfirmationEmail(transaction) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";
  const proName      = transaction.professional?.user?.name || "el profesional";
  const amount       = Number(transaction.amount).toLocaleString("es-CR");
  const currency     = transaction.currency || "CRC";

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2>Pago confirmado</h2>
      <p>Estimado/a <strong>${patientName}</strong>, el pago de <strong>${currency} ${amount}</strong>
         para la cita con ${proName} fue procesado correctamente por ONVO Pay.</p>
      <p>Gracias por su confianza.</p>
      <p style="font-size:12px;color:#64748b;">Este correo fue generado automáticamente.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: patientEmail,
    subject: "Pago confirmado — Salud Mental Costa Rica",
    html,
  });

  if (error) console.error("[ONVO webhook] Error enviando email confirmación:", error);
}

async function sendPaymentFailedEmail(transaction) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const onvoLinkId = transaction.onvoPaymentLinkId;
  const retryUrl = onvoLinkId
    ? `https://checkout.onvopay.com/pay/${onvoLinkId}`
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

  if (error) console.error("[ONVO webhook] Error enviando email fallo:", error);
}
