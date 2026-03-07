// src/app/api/payment/webhook/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/placetopay/webhook";
import { resend } from "@/lib/resend";

// â”€â”€ Helpers de facturaciÃ³n automÃ¡tica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildAutoInvoiceNumber(sequence, now) {
  const padded = String(sequence.currentNumber).padStart(sequence.padding || 4, "0");
  return `${sequence.prefix || ""}${padded}`;
}

/**
 * Crea y valida automÃ¡ticamente una CUSTOMER_INVOICE al aprobarse un pago.
 * Fire-and-forget: errores se logean pero no interrumpen la respuesta.
 */
async function createAutoInvoice(transaction, appointmentServiceTitle) {
  try {
    const amount = Number(transaction.amount);
    if (!amount || amount <= 0) return;

    const typeLabels = { DEPOSIT_50: "DepÃ³sito 50%", BALANCE_50: "Saldo 50%", FULL_100: "Pago completo" };
    const lineLabel = `${typeLabels[transaction.type] || transaction.type} - ${appointmentServiceTitle || "Consulta"}`;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Crear borrador
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: `AUTO-${Date.now()}`,
          invoiceType: "CUSTOMER_INVOICE",
          status: "DRAFT",
          contactId: transaction.patientId,
          appointmentId: transaction.appointmentId,
          professionalId: transaction.professionalId,
          invoiceDate: now,
          dueDate: now,
          subtotal: amount,
          taxAmount: 0,
          discountAmount: 0,
          total: amount,
          amountPaid: 0,
          balance: amount,
          currency: transaction.currency || "CRC",
          notes: `PlacetoPay ref: ${transaction.p2pReference || transaction.p2pRequestId}`,
          lines: {
            create: {
              productName: lineLabel,
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

      // 2. Incrementar secuencia atÃ³micamente
      const sequence = await tx.invoiceSequence.update({
        where: { sequenceType: "CUSTOMER_INVOICE" },
        data: { currentNumber: { increment: 1 }, year: now.getFullYear() },
      });

      // 3. Validar â†’ PAID directo (el pago ya fue cobrado por PlacetoPay)
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: buildAutoInvoiceNumber(sequence, now),
          status: "PAID",
          amountPaid: amount,
          balance: 0,
          paymentDate: now,
        },
      });
    });

    console.log(`[Payment webhook] Invoice auto-creada para transacciÃ³n ${transaction.id}`);
  } catch (err) {
    console.error("[Payment webhook] Error en createAutoInvoice:", err);
  }
}

export const dynamic = "force-dynamic";

const SECRET_KEY = process.env.PLACETOPAY_SECRET_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

/**
 * POST /api/payment/webhook
 * Ruta pÃºblica â€” verificada por firma PlacetoPay, NO por JWT.
 *
 * PlacetoPay envÃ­a notificaciones cuando cambia el estado de una sesiÃ³n de pago.
 * Siempre responde 200 para evitar reintentos innecesarios.
 */
export async function POST(request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    // Si el body es invÃ¡lido, responder 200 de todas formas para que P2P no reintente
    console.error("[Payment webhook] Body JSON invÃ¡lido.");
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 200 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  console.log("[Payment webhook] Recibido desde IP:", ip, "| requestId:", rawBody?.requestId);

  // â”€â”€ 1. Verificar firma â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { requestId, status: statusObj, signature } = rawBody;
  const p2pStatus = statusObj?.status;
  const p2pDate   = statusObj?.date;

  if (!SECRET_KEY) {
    console.error("[Payment webhook] PLACETOPAY_SECRET_KEY no configurada.");
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const isValid = verifyWebhookSignature({
    requestId,
    status:    p2pStatus,
    date:      p2pDate,
    signature,
    secretKey: SECRET_KEY,
  });

  if (!isValid) {
    console.error("[Payment webhook] Firma invÃ¡lida. Descartando notificaciÃ³n.");
    return NextResponse.json({ ok: false, message: "Invalid signature" }, { status: 200 });
  }

  // â”€â”€ 2. Buscar transacciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { p2pRequestId: Number(requestId) },
    include: {
      appointment: {
        select: {
          id: true,
          isFirstWithProfessional: true,
          paymentStatus: true,
          pricePaid: true,
          service: { select: { title: true } },
        },
      },
      patient: { select: { name: true, email: true } },
      professional: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  if (!transaction) {
    console.warn("[Payment webhook] TransacciÃ³n no encontrada para requestId:", requestId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Idempotencia: ignorar si ya fue procesada
  if (transaction.status === "APPROVED" || transaction.status === "REFUNDED") {
    console.log("[Payment webhook] TransacciÃ³n ya procesada. Ignorando.");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // â”€â”€ 3. Mapear estado P2P â†’ interno â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statusMap = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING:  "PENDING",
    FAILED:   "REJECTED",
    EXPIRED:  "EXPIRED",
  };
  const newStatus = statusMap[p2pStatus] || "PENDING";

  // â”€â”€ 4. Actualizar transacciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status:           newStatus,
      p2pStatusCode:    statusObj?.reason || null,
      p2pStatusMessage: statusObj?.message || null,
      p2pPaymentDate:   p2pDate ? new Date(p2pDate) : null,
      webhookPayload:   rawBody,
    },
  });

  // â”€â”€ 5. Actualizar paymentStatus de la cita â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (newStatus === "APPROVED") {
    const isDeposit = transaction.type === "DEPOSIT_50";
    const newPaymentStatus = isDeposit ? "PARTIALLY_PAID" : "PAID";

    await prisma.appointment.update({
      where: { id: transaction.appointmentId },
      data: { paymentStatus: newPaymentStatus },
    });

    console.log(
      `[Payment webhook] Cita ${transaction.appointmentId} â†’ paymentStatus: ${newPaymentStatus}`
    );

    // â”€â”€ 6. Generar factura automÃ¡tica + enviar email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await Promise.allSettled([
      createAutoInvoice(transaction, transaction.appointment?.service?.title),
      sendPaymentConfirmationEmail({ transaction, p2pStatus, isDeposit }),
    ]);
  } else if (newStatus === "REJECTED" || newStatus === "EXPIRED") {
    await sendPaymentFailedEmail({ transaction });
  }


  return NextResponse.json({ ok: true }, { status: 200 });
}

// â”€â”€ Email helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function sendPaymentConfirmationEmail({ transaction, isDeposit }) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";
  const proName      = transaction.professional?.user?.name || "el profesional";
  const amount       = Number(transaction.amount).toLocaleString("es-CR");
  const currency     = transaction.currency;

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const subject = isDeposit ? "Depósito recibido" : "Pago confirmado";
  const body = isDeposit
    ? `<p>Estimado/a ${patientName}, se recibio el deposito de <strong>${currency} ${amount}</strong> para la cita con ${proName}. La cita continua reservada.</p><p>Se recuerda que el saldo restante se cobrará al concluir la sesión.</p>`
    : `<p>Estimado/a ${patientName}, el pago de <strong>${currency} ${amount}</strong> para la cita con ${proName} fue procesado correctamente.</p>`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;"><h2>${subject}</h2>${body}<p style="font-size:12px;color:#64748b;">Este correo fue generado automáticamente.</p></div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: patientEmail,
    subject,
    html,
  });

  if (error) console.error("[Payment webhook] Error enviando email confirmación:", error);
}

async function sendPaymentFailedEmail({ transaction }) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const APP_URL = process.env.APP_URL || "http://localhost:3000";
  const retryUrl = `${APP_URL}/panel/paciente`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;"><h2>Pago no procesado</h2><p>Estimado/a ${patientName}, el pago no pudo ser procesado.</p><p><a href="${retryUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Reintentar pago</a></p><p style="font-size:12px;color:#64748b;">Este correo fue generado automÃ¡ticamente.</p></div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: patientEmail,
    subject: "No fue posible procesar el pago",
    html,
  });

  if (error) console.error("[Payment webhook] Error enviando email fallo:", error);
}






