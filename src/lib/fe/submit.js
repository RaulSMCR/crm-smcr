// src/lib/fe/submit.js
// Lógica compartida de envío de Factura Electrónica (FE) a Hacienda CR.
//
// Usada por:
//   • /api/invoices/[id]/submit-fe  (envío manual por el admin)
//   • /api/payment/webhook          (envío automático al confirmar pago ONVO)
//
// Modo real:  requiere FE_API_URL en env → llama submitToHacienda()
// Modo mock:  sin FE_API_URL → genera números FE simulados (desarrollo)

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { assertFeConfig } from "@/lib/fe/config.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";
const FE_REAL_API_URL = process.env.FE_API_URL || null;

// ─── Email al paciente ───────────────────────────────────────────────────────

/**
 * Envía el comprobante de Factura Electrónica al paciente por email.
 *
 * @param {object} invoice  Factura con feNumber, feClave, contact.email, lines, etc.
 */
export async function sendFeEmail(invoice) {
  const patientEmail = invoice.contact?.email;
  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const currency = invoice.currency || "CRC";
  const fmt  = new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 });
  const total = fmt.format(Number(invoice.total));
  const date  = new Date(invoice.invoiceDate).toLocaleDateString("es-CR", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lineRows = (invoice.lines || []).map((l) => {
    const prod    = l.product?.name || l.description || "Servicio";
    const unitFmt = fmt.format(Number(l.unitPrice));
    const lineFmt = fmt.format(Number(l.lineTotal));
    return `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 4px;">${prod}${l.description && l.description !== prod ? ` — ${l.description}` : ""}</td>
      <td style="padding:8px 4px;text-align:center;">${l.quantity}</td>
      <td style="padding:8px 4px;text-align:right;">${unitFmt}</td>
      <td style="padding:8px 4px;text-align:right;">${lineFmt}</td>
    </tr>`;
  }).join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Factura Electrónica emitida</h2>
      <p>Estimado/a cliente, adjuntamos los datos de su factura electrónica emitida ante el Ministerio de Hacienda de Costa Rica.</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr>
          <td style="padding:6px 8px;color:#64748b;width:160px;">Número de factura</td>
          <td style="padding:6px 8px;font-weight:600;">${invoice.invoiceNumber}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:6px 8px;color:#64748b;">Número FE (Hacienda)</td>
          <td style="padding:6px 8px;font-weight:600;">${invoice.feNumber || "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;color:#64748b;">Clave numérica</td>
          <td style="padding:6px 8px;font-size:12px;word-break:break-all;">${invoice.feClave || "—"}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:6px 8px;color:#64748b;">Fecha</td>
          <td style="padding:6px 8px;">${date}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px;color:#64748b;">Total</td>
          <td style="padding:6px 8px;font-weight:700;font-size:16px;">${total}</td>
        </tr>
      </table>

      <h3 style="font-size:14px;color:#374151;margin-top:24px;">Detalle</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px 4px;">Descripción</th>
            <th style="padding:8px 4px;text-align:center;">Cant.</th>
            <th style="padding:8px 4px;text-align:right;">Precio unit.</th>
            <th style="padding:8px 4px;text-align:right;">Total línea</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      ${invoice.notes ? `<p style="margin-top:16px;font-size:13px;color:#64748b;">Ref: ${invoice.notes}</p>` : ""}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Este documento tiene validez tributaria conforme a la Ley 9069 de Costa Rica.
        Puede verificarlo en el portal de Hacienda con la clave numérica indicada.
      </p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to:   patientEmail,
    subject: `Factura electrónica ${invoice.invoiceNumber} — Salud Mental Costa Rica`,
    html,
  });

  if (error) console.error("[FE] Error enviando email al paciente:", error);
  else console.log(`[FE] Email de FE enviado a ${patientEmail} para factura ${invoice.invoiceNumber}`);
}

// ─── Alerta al administrador ─────────────────────────────────────────────────

/**
 * Avisa al administrador cuando una factura no pudo emitirse porque falta la
 * integración de FE (producción sin FE_API_URL). NO se envía nada al paciente.
 *
 * @param {object} invoice  Factura afectada (con invoiceNumber, total, etc.)
 */
async function sendFeConfigAlert(invoice) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!to || !process.env.RESEND_API_KEY) {
    console.error(
      "[FE] No se pudo alertar al admin: falta ADMIN_ALERT_EMAIL/EMAIL_FROM o RESEND_API_KEY."
    );
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#b91c1c;">Factura electrónica NO emitida</h2>
      <p>La factura <strong>${invoice.invoiceNumber}</strong> no pudo enviarse a Hacienda
         porque la integración de facturación electrónica no está configurada
         (falta la variable <code>FE_API_URL</code>).</p>
      <p>La factura quedó en estado <strong>PENDIENTE</strong>. No se emitió ningún comprobante
         ni se envió correo de FE al paciente.</p>
      <p style="margin-top:16px;">Acción requerida: emitir la factura manualmente ante Hacienda
         o configurar la integración de FE antes de seguir cobrando.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
        Alerta automática del sistema de facturación de Salud Mental Costa Rica.
      </p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `⚠ FE no emitida — factura ${invoice.invoiceNumber} pendiente`,
    html,
  });

  if (error) console.error("[FE] Error enviando alerta de configuración al admin:", error);
  else console.log(`[FE] Alerta de FE no configurada enviada al admin para factura ${invoice.invoiceNumber}`);
}

// ─── Envío a Hacienda ────────────────────────────────────────────────────────

/**
 * Orquesta el envío completo de una factura a Hacienda CR + email al paciente.
 *
 * - Idempotente: si la factura ya está ACCEPTED no hace nada.
 * - Modo real:  llama submitToHacienda() cuando FE_API_URL está configurada.
 * - Modo mock:  genera números FE simulados para desarrollo/testing.
 *
 * @param {string} invoiceId
 * @returns {Promise<{ feStatus: string, feNumber: string|null, feClave: string|null, feErrorMessage: string|null }>}
 */
export async function submitInvoiceToFe(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      feStatus: true,
      invoiceNumber: true,
      invoiceType: true,
      invoiceDate: true,
      dueDate: true,
      feNumber: true,
      feClave: true,
      contactName: true,
      contactIdNumber: true,
      economicActivity: true,
      paymentMethod: true,
      currency: true,
      subtotal: true,
      taxAmount: true,
      discountAmount: true,
      total: true,
      notes: true,
      originDocument: true,
      originInvoice: { select: { invoiceDate: true } },
      contact: { select: { email: true, name: true, identification: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          quantity: true,
          unitPrice: true,
          discountPercent: true,
          taxRate: true,
          taxAmount: true,
          lineSubtotal: true,
          lineTotal: true,
          description: true,
          cabysCode: true,
          service: { select: { title: true, cabysCode: true } },
          product: { select: { name: true, cabysCode: true, saleUom: true } },
        },
      },
    },
  });

  if (!invoice) {
    console.error(`[FE] submitInvoiceToFe: factura ${invoiceId} no encontrada.`);
    return { feStatus: "REJECTED", feNumber: null, feClave: null, feErrorMessage: "Factura no encontrada." };
  }

  // Guard: solo facturas validadas
  if (invoice.status !== "OPEN" && invoice.status !== "PAID") {
    console.warn(`[FE] submitInvoiceToFe: factura ${invoiceId} en estado ${invoice.status}, omitiendo.`);
    return { feStatus: invoice.feStatus, feNumber: invoice.feNumber, feClave: invoice.feClave, feErrorMessage: null };
  }

  // Idempotencia: ya aceptada
  if (invoice.feStatus === "ACCEPTED" && invoice.feNumber) {
    console.log(`[FE] submitInvoiceToFe: factura ${invoiceId} ya ACCEPTED, omitiendo.`);
    return { feStatus: "ACCEPTED", feNumber: invoice.feNumber, feClave: invoice.feClave, feErrorMessage: null };
  }

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  let feNumber, feClave, feStatus, feErrorMessage;
  // Solo el envío por la integración real de Hacienda produce un comprobante con
  // validez tributaria. El modo mock JAMÁS debe enviar el correo al paciente.
  let realAcceptance = false;

  if (FE_REAL_API_URL) {
    // ── Integración real con Hacienda CR ─────────────────────────────────────
    try {
      assertFeConfig();
      const { submitToHacienda } = await import("@/lib/fe/client.js");
      const result = await submitToHacienda(invoice, invoice.lines);
      feNumber       = result.feNumber;
      feClave        = result.feClave;
      feStatus       = result.feStatus;
      feErrorMessage = result.feErrorMessage || null;
      realAcceptance = feStatus === "ACCEPTED";
    } catch (err) {
      console.error(`[FE] submitInvoiceToFe: error enviando factura ${invoiceId} a Hacienda:`, err);
      if (String(err?.message || "").startsWith("Configuración FE") || String(err?.message || "").includes("No se permite ambiente fiscal")) {
        feStatus       = "PENDING";
        feErrorMessage = err.message;
        await prisma.invoice.update({ where: { id: invoiceId }, data: { feNumber: null, feClave: null, feStatus, feErrorMessage } });
        await sendFeConfigAlert(invoice).catch((e) => console.error("[FE] Error alertando configuración:", e));
        return { feStatus, feNumber: null, feClave: null, feErrorMessage };
      }
      feStatus       = "REJECTED";
      feNumber       = null;
      feClave        = null;
      feErrorMessage = err.message || "Error desconocido al conectar con Hacienda.";
    }
  } else if (isProduction) {
    // ── Producción SIN FE_API_URL: NO simular ────────────────────────────────
    // Emitir un comprobante simulado a un paciente real sería un fraude tributario
    // ante Hacienda. Dejamos la factura PENDING, alertamos al admin y no enviamos
    // ningún correo de FE al paciente.
    feStatus       = "PENDING";
    feNumber       = null;
    feClave        = null;
    feErrorMessage = "FE no configurada: falta FE_API_URL. Emitir manualmente o configurar la integración.";
    console.error(
      `[FE] Producción sin FE_API_URL: factura ${invoice.invoiceNumber} (${invoiceId}) queda PENDING sin emitir.`
    );

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { feNumber, feClave, feStatus, feErrorMessage },
    });

    await sendFeConfigAlert(invoice).catch((e) =>
      console.error("[FE] Error enviando alerta de configuración al admin:", e)
    );

    return { feStatus, feNumber, feClave, feErrorMessage };
  } else {
    // ── Modo mock: FE simulada (desarrollo, sin FE_API_URL configurada) ──────
    const { buildFeNumber, buildFeClave, extractConsecutivo } = await import("@/lib/fe/xml.js");
    const { TIPO_DOC_MAP } = await import("@/lib/fe/config.js");
    const tipoDoc    = TIPO_DOC_MAP[invoice.invoiceType] || "01";
    const consecutivo = extractConsecutivo(invoice.invoiceNumber);
    feNumber       = buildFeNumber(invoice.invoiceType, consecutivo);
    feClave        = buildFeClave(tipoDoc, feNumber, invoice.invoiceDate);
    feStatus       = "ACCEPTED";
    feErrorMessage = "SIMULADO — sin validez tributaria";
    console.log(`[FE MOCK] Factura ${invoice.invoiceNumber} → feNumber=${feNumber} (SIMULADO, sin validez tributaria)`);
  }

  // Actualizar factura en BD
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { feNumber, feClave, feStatus, feErrorMessage },
  });

  // Enviar email al paciente SOLO si la aceptación provino de la integración real.
  if (realAcceptance) {
    const enriched = { ...invoice, feNumber, feClave, feStatus };
    sendFeEmail(enriched).catch((e) => console.error("[FE] Error en sendFeEmail:", e));
  }

  return { feStatus, feNumber, feClave, feErrorMessage };
}
