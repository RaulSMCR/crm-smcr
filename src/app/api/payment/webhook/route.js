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
import { matchTransaction } from "@/lib/onvo/match-payment";
import { normalizeOnvoEvent } from "@/lib/onvo/event";
import { escapePaymentAlertValue, logOnvoWebhook } from "@/lib/onvo/observability";
import { resend } from "@/lib/resend";
import { submitInvoiceToFe } from "@/lib/fe/submit";
import { sendInsuranceProSignAlert } from "@/lib/insurance-mail";
import { splitTaxIncluded } from "@/lib/invoice-math";
import { datosFacturacionDe } from "@/lib/fiscal-identity";
import { estimateOnvoFee } from "@/lib/commission-plan";
import { obtenerTipoCambio } from "@/lib/exchange-rate";
import { paymentTypeLabel } from "@/lib/payment-requests";
import { detalleLineaFactura } from "@/lib/detalle-consulta";
import { detalleLugarCita, lugarCitaEnUnaLinea } from "@/lib/lugar-cita";
import { reportDepositConversion } from "@/lib/analytics/reportDepositConversion";
import { SITE_URL } from "@/lib/site-url";
import { sendPurchaseMeta } from "@/lib/analytics/meta-events";
import { after } from "next/server";

export const dynamic = "force-dynamic";

const ONVO_WEBHOOK_SECRET = process.env.ONVO_WEBHOOK_SECRET;

/**
 * Campos de comisión a guardar en la transacción, en unidades de moneda.
 * El fijo de ONVO se cobra en dólares, así que se conserva en dólares junto al
 * tipo de cambio aplicado; processingFee es la suma estimada en colones.
 */
async function desgloseComision(amount, paymentMethod) {
  // El tipo de cambio del día, no uno fijo: es lo que después permite cuadrar
  // contra la liquidación de ONVO, que llega convertida con la tasa de su día.
  const { rate } = await obtenerTipoCambio();
  const fee = estimateOnvoFee(Math.round(Number(amount) * 100), paymentMethod, {
    usdCrcRate: rate,
  });
  return {
    processingFee: fee.totalCents / 100,
    processingFeeUsd: fee.fixedUsd,
    usdCrcRate: fee.usdCrcRate,
  };
}
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
    tipo: eventType,
    onvoLinkId,
    paidAt,
    amount: eventAmount,
    currency: eventCurrency,
    customerEmail: eventCustomerEmail,
  } = evento;

  Object.assign(trace, { eventId, onvoLinkId });
  // La evidencia autenticada de conciliación queda en la BD; no se duplica
  // en logs con correos, datos del cliente, cabeceras o contenido del evento.
  logOnvoWebhook("info", "RECEIVED", { eventId, onvoLinkId, status: evento.resultado });

  if (!eventId) {
    logOnvoWebhook("warn", "EVENT_ID_MISSING");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 3. Idempotencia: ignorar eventos ya procesados ───────────────────────
  const [alreadyProcessed, alreadyUnmatched] = await Promise.all([
    prisma.paymentTransaction.findFirst({ where: { onvoEventId: eventId } }),
    prisma.unmatchedPayment.findUnique({ where: { onvoEventId: eventId } }),
  ]);
  if (alreadyProcessed || alreadyUnmatched) {
    logOnvoWebhook("info", "ALREADY_PROCESSED", { eventId });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // ── 4. Emparejar el evento con la transacción correcta (PAY-01) ──────────
  // El enlace es compartido, así que puede haber varias transacciones activas.
  // Emparejamos por monto, moneda y correo del pagador; nunca adivinamos.
  const candidates = onvoLinkId
    ? await prisma.paymentTransaction.findMany({
        where: {
          onvoPaymentLinkId: onvoLinkId,
          status: { in: ["PENDING", "LINK_SENT"] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          appointment: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              isFirstWithProfessional: true,
              date: true,
              locationName: true,
              locationAddress: true,
              locationNotes: true,
              modality: true,
              pricePaid: true,
              service: { select: { id: true, title: true, cabysCode: true, taxId: true, tax: { select: { id: true, rate: true } } } },
            },
          },
          patient: {
            select: {
              name: true,
              email: true,
              identification: true,
              billingName: true,
              billingIdType: true,
              billingIdNumber: true,
              billingEmail: true,
              hasInsurance: true,
              useInsuranceForPayment: true,
              insuranceName: true,
              insuranceTemplateUrl: true,
            },
          },
          professional: {
            select: { academicDegree: true, user: { select: { name: true, email: true } } },
          },
        },
      })
    : [];

  const enrichedCandidates = candidates.map((t) => ({ ...t, patientEmail: t.patient?.email }));
  const matchResult = matchTransaction(enrichedCandidates, {
    amount: eventAmount,
    currency: eventCurrency,
    customerEmail: eventCustomerEmail,
  });

  if (matchResult.unmatchedReason) {
    // `unmatchedDetail` trae el diagnóstico cuando lo hay (p. ej. divisor de monto mal configurado).
    const unmatchedReason = matchResult.unmatchedDetail || matchResult.unmatchedReason;
    logOnvoWebhook("warn", "UNMATCHED", { eventId, onvoLinkId, reason: matchResult.unmatchedReason });
    await recordUnmatchedPayment({
      eventId,
      onvoLinkId,
      amount: eventAmount,
      currency: eventCurrency,
      customerEmail: eventCustomerEmail,
      reason: unmatchedReason,
      payload,
    });
    await sendAdminPaymentAlert({
      subject: `⚠ Pago ONVO no conciliado (${matchResult.unmatchedReason})`,
      reason: unmatchedReason,
      eventId,
      onvoLinkId,
      amount: eventAmount,
      currency: eventCurrency,
    }).catch((error) => logOnvoWebhook("error", "UNMATCHED_ALERT_FAILED", { eventId, error }));
    // NO tocar ninguna cita.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const transaction = matchResult.match;

  // ── 5. Mapear estado ONVO → estado interno ───────────────────────────────
  const newStatus =
    evento.resultado === "aprobado" ? "APPROVED"
    : evento.resultado === "rechazado" ? "REJECTED"
    : "LINK_SENT";

  // ── 6. Actualizar la transacción ─────────────────────────────────────────
  const updatedTransaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      onvoEventId:   eventId,
      status:        newStatus,
      statusMessage: `ONVO: ${eventType || evento.resultado}`,
      paidAt:        newStatus === "APPROVED" ? paidAt : null,
      webhookPayload: payload,
      ...(newStatus === "APPROVED"
        ? {
            taxRate: Number(transaction.appointment?.service?.tax?.rate ?? 4),
            // Se guardan los tres datos: el total convertido, el fijo en la
            // moneda en que ONVO lo cobra y el tipo de cambio usado. La
            // liquidación de ONVO va a traer su propio tipo de cambio, y sin
            // esto la diferencia no se podría explicar.
            ...(await desgloseComision(transaction.amount, evento.paymentMethod)),
          }
        : {}),
    },
  });
  const processedTransaction = { ...transaction, ...updatedTransaction };

  // ── 7. Si el pago fue aprobado: actualizar cita + crear factura + email ──
  if (newStatus === "APPROVED") {
    const nextPaymentStatus = processedTransaction.type === "DEPOSIT_50" ? "PARTIALLY_PAID" : "PAID";
    await prisma.appointment.update({
      where: { id: processedTransaction.appointmentId },
      data: { paymentStatus: nextPaymentStatus },
    });

    logOnvoWebhook("info", "APPOINTMENT_PAYMENT_UPDATED", {
      eventId, transactionId: processedTransaction.id,
      appointmentId: processedTransaction.appointmentId, status: nextPaymentStatus,
    });

    const [invoiceResult] = await Promise.allSettled([
      createAutoInvoice(processedTransaction),
      sendPaymentConfirmationEmail(processedTransaction),
    ]);

    const invoiceId = invoiceResult.status === "fulfilled" ? invoiceResult.value : null;
    if (invoiceId) {
      // Va dentro de after(): sin eso la promesa queda suelta y el runtime puede
      // congelar la función al responderle a ONVO, dejando la factura en
      // feStatus=PENDING para siempre. Pasó con la 0154 del 14/8: la factura se
      // creó, el envío a Hacienda nunca ocurrió y nadie recibió el comprobante.
      after(() =>
        submitInvoiceToFe(invoiceId).catch((e) =>
          logOnvoWebhook("error", "FE_SUBMIT_FAILED", { invoiceId, error: e })
        )
      );
    }

    // Conversión GA4/Ads del adelanto de primera cita (server-to-server).
    // Idempotente: no reenvía si ya se contabilizó (ver reportDepositConversion).
    if (processedTransaction.type === "DEPOSIT_50") {
      reportDepositConversion(processedTransaction.id).catch((e) =>
        logOnvoWebhook("error", "DEPOSIT_CONVERSION_FAILED", { transactionId: processedTransaction.id, error: e })
      );
      // Purchase a Meta CAPI (fire-and-forget). Dedup por eventId purchase:<txId>.
      after(() => sendPurchaseMeta(processedTransaction.id));
    }

    if (nextPaymentStatus === "PAID") {
      handleInsuranceClaim(processedTransaction, paidAt).catch((e) =>
        logOnvoWebhook("error", "INSURANCE_CLAIM_FAILED", { transactionId: processedTransaction.id, error: e })
      );
    }
  } else if (newStatus === "REJECTED") {
    await sendPaymentFailedEmail(processedTransaction);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── Facturación automática ───────────────────────────────────────────────────

export async function createAutoInvoice(transaction) {
  try {
    const amount = Number(transaction.amount);
    if (!amount || amount <= 0) return null;

    // Lo que Hacienda y el paciente leen en la línea: servicios profesionales,
    // una consulta, con su fecha y con el nombre y el título de quien atendió.
    // El desglose del 4% incluido en lo que se pagó va abajo, en el importe.
    const { productName, description } = detalleLineaFactura({
      fecha: transaction.appointment?.date,
      profesional: transaction.professional,
      paymentType: transaction.type,
    });
    const service = transaction.appointment?.service;
    const taxRate = Number(service?.tax?.rate ?? 4);
    const { baseCents, taxCents } = splitTaxIncluded(Math.round(amount * 100), taxRate);
    const baseAmount = baseCents / 100;
    const taxAmount = taxCents / 100;
    const fiscalWarning = !service?.cabysCode || !service?.taxId;
    const now = new Date();

    if (fiscalWarning) {
      await sendAdminPaymentAlert({
        subject: "⚠ Servicio sin CABYS/IVA configurado",
        reason: "Servicio sin CABYS/IVA configurado: revisar antes de enviar a Hacienda",
        eventId: transaction.onvoEventId,
        onvoLinkId: transaction.onvoPaymentLinkId,
        amount,
        currency: transaction.currency || "CRC",
      }).catch((error) => logOnvoWebhook("error", "FISCAL_ALERT_FAILED", { transactionId: transaction.id, error }));
    }

    let finalInvoiceId = null;

    const receptor = datosFacturacionDe(transaction.patient);

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: `AUTO-${Date.now()}`,
          invoiceType: "CUSTOMER_INVOICE",
          status: "DRAFT",
          contactId: transaction.patientId,
          appointmentId: transaction.appointmentId,
          professionalId: transaction.professionalId,
          // Si el paciente cargó datos de facturación, la factura sale a nombre
          // de esa persona o empresa: es lo que le permite deducirla. Si no,
          // sale con su propia identidad, como siempre.
          contactName:     receptor.nombre || null,
          contactIdNumber: receptor.identificacion || null,
          contactIdType:   receptor.tipoIdentificacion || null,
          paymentMethod:   "transfer",
          invoiceDate: now,
          dueDate: now,
          subtotal: baseAmount,
          taxAmount,
          discountAmount: 0,
          total: amount,
          amountPaid: 0,
          balance: amount,
          currency: transaction.currency || "CRC",
          notes: `ONVO Pay | Enlace: ${transaction.onvoPaymentLinkId || "-"} | Evento: ${transaction.onvoEventId || "-"}${fiscalWarning ? " | ALERTA: Servicio sin CABYS/IVA configurado" : ""}`,
          lines: {
            create: {
              productName,
              description,
              serviceId: transaction.appointment?.service?.id || transaction.appointment?.serviceId || null,
              cabysCode: service?.cabysCode || null,
              taxId: service?.taxId || null,
              quantity: 1,
              unitPrice: baseAmount,
              discountPercent: 0,
              taxRate,
              taxAmount,
              lineSubtotal: baseAmount,
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

    logOnvoWebhook("info", "AUTO_INVOICE_CREATED", { transactionId: transaction.id, invoiceId: finalInvoiceId });
    return finalInvoiceId;
  } catch (err) {
    logOnvoWebhook("error", "AUTO_INVOICE_FAILED", { transactionId: transaction.id, error: err });
    return null;
  }
}

// ── Pagos no conciliados (PAY-01) ─────────────────────────────────────────────

/**
 * Registra un pago que no se pudo emparejar con una transacción, para
 * conciliación manual posterior. Idempotente por onvoEventId.
 */
async function recordUnmatchedPayment({ eventId, onvoLinkId, amount, currency, customerEmail, reason, payload }) {
  try {
    await prisma.unmatchedPayment.upsert({
      where: { onvoEventId: eventId },
      update: {},
      create: {
        onvoEventId: eventId,
        onvoLinkId: onvoLinkId || null,
        amount: amount != null ? amount : null,
        currency: currency || null,
        customerEmail: customerEmail || null,
        reason,
        payload,
      },
    });
  } catch (err) {
    logOnvoWebhook("error", "UNMATCHED_SAVE_FAILED", { eventId, error: err });
  }
}

/**
 * Alerta de incidencias autenticadas, con referencias para consultar el panel.
 * No incluye la identidad del pagador y escapa los valores interpolados.
 */
async function sendAdminPaymentAlert({ subject, reason, eventId, onvoLinkId, amount, currency }) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!to || !process.env.RESEND_API_KEY) {
    logOnvoWebhook("error", "ADMIN_ALERT_UNAVAILABLE", { eventId });
    return;
  }

  const safe = escapePaymentAlertValue;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#b91c1c;">Pago ONVO requiere revisión</h2>
      <p>Un webhook de ONVO no pudo procesarse automáticamente. <strong>No se modificó ninguna cita.</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 8px;color:#64748b;width:180px;">Motivo</td><td style="padding:6px 8px;font-weight:600;">${safe(reason)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Evento ONVO</td><td style="padding:6px 8px;">${safe(eventId)}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b;">Enlace de pago</td><td style="padding:6px 8px;">${safe(onvoLinkId)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Monto</td><td style="padding:6px 8px;">${safe(amount)} ${safe(currency)}</td></tr>
      </table>
      <p style="font-size:13px;color:#475569;">Acción: concilie el pago manualmente en el panel de ONVO y con la cita correspondiente.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">Alerta automática del sistema de pagos de Salud Mental Costa Rica.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (error) logOnvoWebhook("error", "ADMIN_ALERT_FAILED", { eventId, error });
}

// ── Emails ───────────────────────────────────────────────────────────────────

async function sendPaymentConfirmationEmail(transaction) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";
  const proName      = transaction.professional?.user?.name || "el profesional";
  const amount       = Number(transaction.amount).toLocaleString("es-CR");
  const currency     = transaction.currency || "CRC";
  const paymentLabel = paymentTypeLabel(transaction.type);

  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const cita = transaction.appointment;
  const cuando = cita?.date
    ? new Intl.DateTimeFormat("es-CR", {
        timeZone: "America/Costa_Rica",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(cita.date))
    : null;

  // El correo que confirma el pago es el que la gente guarda: acá va la
  // dirección completa, cómo llegar, y —si es virtual— cuándo llega el enlace.
  const lugar = lugarCitaEnUnaLinea(cita) || null;
  const avisoLugar = detalleLugarCita(cita).aviso;

  const total = cita?.pricePaid ? Number(cita.pricePaid).toLocaleString("es-CR") : null;
  const saldo =
    cita?.pricePaid && transaction.type === "DEPOSIT_50"
      ? (Number(cita.pricePaid) - Number(transaction.amount)).toLocaleString("es-CR")
      : null;

  // Qué le queda por delante al paciente. Es la parte que de verdad necesita:
  // saber si ya terminó de pagar o si le espera otro cobro, y cuándo.
  const reglas =
    transaction.type === "DEPOSIT_50"
      ? `<p style="margin:0;">Con este adelanto <strong>tu cita queda reservada</strong>. El saldo
           de <strong>${currency} ${saldo || "—"}</strong> se cobra <strong>al concluir la
           consulta</strong>: vas a recibir entonces un segundo enlace de pago por correo.</p>
         <p style="margin:12px 0 0;">Se cobra la mitad por adelantado solo en la primera cita con
           cada profesional. En las siguientes se cobra el total al terminar la consulta.</p>`
      : transaction.type === "BALANCE_50"
        ? `<p style="margin:0;">Con este pago <strong>la cita queda saldada</strong>. No hay
             cobros pendientes.</p>`
        : `<p style="margin:0;">La cita queda <strong>pagada por completo</strong>. No hay cobros
             pendientes.</p>`;

  const filas = [
    ["Profesional", proName],
    ["Servicio", cita?.service?.title],
    ["Fecha y hora", cuando],
    ["Lugar", lugar],
    ["Precio de la consulta", total ? `${currency} ${total}` : null],
  ]
    .filter(([, valor]) => valor)
    .map(
      ([etiqueta, valor], i) => `
        <tr${i % 2 ? ' style="background:#f8fafc;"' : ""}>
          <td style="padding:6px 8px;color:#64748b;width:170px;">${etiqueta}</td>
          <td style="padding:6px 8px;font-weight:600;">${valor}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#047857;">¡Tu cita quedó reservada!</h2>
      <p>Hola <strong>${patientName}</strong>, recibimos tu ${paymentLabel} de
         <strong>${currency} ${amount}</strong>.</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${filas}</table>
      ${avisoLugar ? `<p style="margin:-6px 0 16px;font-size:13px;color:#475569;">${avisoLugar}</p>` : ""}

      <div style="padding:14px;border:1px solid #a7f3d0;border-radius:8px;background:#ecfdf5;
                  font-size:14px;color:#065f46;">
        ${reglas}
      </div>

      <p style="margin-top:16px;font-size:13px;color:#475569;">
        Tu factura electrónica llega en un correo aparte, con el comprobante adjunto.
      </p>
      <p style="margin-top:16px;font-size:13px;color:#475569;">
        ¿Necesitás mover la cita? Podés hacerlo desde tu panel avisando con al menos 24 horas.
        Las condiciones completas están en
        <a href="${SITE_URL}/terminos">términos y condiciones</a>.
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
        Este correo fue generado automáticamente por Salud Mental Costa Rica.
      </p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: patientEmail,
    subject: `Cita reservada — ${paymentLabel} confirmado`,
    html,
  });

  if (error) logOnvoWebhook("error", "PAYMENT_CONFIRMATION_EMAIL_FAILED", { transactionId: transaction.id, error });
}

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
      sendInsuranceProSignAlert({
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
