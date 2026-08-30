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
import { FE_EMISOR } from "@/lib/fe/config";
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

  // FE_AMBIENTE 02 es el sandbox de Hacienda: los comprobantes emitidos ahí NO
  // tienen validez tributaria y el correo no puede afirmar lo contrario, menos
  // aún cuando durante las pruebas llega a personas reales.
  const esPrueba = FE_EMISOR.ambiente !== "01";
  // En el sandbox el comprobante se manda aunque Hacienda lo rechace, para poder
  // verificar el recorrido completo; el correo tiene que decirlo sin ambigüedad.
  const fueRechazada = invoice.feStatus === "REJECTED";

  const currency = invoice.currency || "CRC";
  const fmt  = new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: 0 });
  const total = fmt.format(Number(invoice.total));
  const date  = new Date(invoice.invoiceDate).toLocaleDateString("es-CR", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lineRows = (invoice.lines || []).map((l) => {
    // Mismo criterio que el XML: el nombre de la línea y su descripción son dos
    // datos distintos y el correo tiene que decir los dos.
    const prod    = l.productName || l.product?.name || l.description || "Servicio";
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
      <h2 style="color:${fueRechazada ? "#b91c1c" : "#1e40af"};">Factura Electrónica${fueRechazada ? " RECHAZADA" : " emitida"}${esPrueba ? " (PRUEBA)" : ""}</h2>
      <p>Estimado/a cliente, adjuntamos los datos de su factura electrónica emitida ante el Ministerio de Hacienda de Costa Rica.</p>

      <!-- Quién emite. Va en el correo y no solo dentro del XML: quien recibe la
           factura tiene que poder leer de quién es sin abrir el comprobante. Son
           los mismos datos que el XML declara en <Emisor>. -->
      <div style="margin:16px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:13px;line-height:1.6;">
        <div style="font-weight:700;color:#0f172a;">${FE_EMISOR.nombre}</div>
        <div style="color:#475569;">Cédula jurídica ${FE_EMISOR.identificacion}</div>
        <div style="color:#475569;">Actividad económica ${FE_EMISOR.actividadEconomica}</div>
        <div style="color:#475569;">${FE_EMISOR.ubicacion.otrasSenas}</div>
        <div style="color:#475569;">Tel. +${FE_EMISOR.telefono.codigoPais} ${FE_EMISOR.telefono.numTelefono} · ${FE_EMISOR.correo}</div>
      </div>

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
        <!-- El impuesto va dentro de lo que la persona pagó: el total es el
             mismo que se cobró por tarjeta. Se desglosa para que se vea que el
             4% ya estaba adentro y no es un cargo adicional. -->
        <tr>
          <td style="padding:6px 8px;color:#64748b;">Subtotal</td>
          <td style="padding:6px 8px;">${fmt.format(Number(invoice.subtotal))}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td style="padding:6px 8px;color:#64748b;">IVA incluido</td>
          <td style="padding:6px 8px;">${fmt.format(Number(invoice.taxAmount))}</td>
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
      ${esPrueba ? `
      <p style="margin-top:24px;padding:12px;border:2px solid #b91c1c;border-radius:8px;background:#fef2f2;color:#7f1d1d;font-weight:600;">
        DOCUMENTO DE PRUEBA — SIN VALIDEZ TRIBUTARIA.
        Emitido contra el ambiente de pruebas del Ministerio de Hacienda.
        No sirve como respaldo fiscal ni acredita ningún pago real.
        ${fueRechazada ? `<br><br>Además, Hacienda lo <b>rechazó</b>. En el ambiente de pruebas
        esto es esperable: su padrón de contribuyentes es independiente del real, así que no
        reconoce ni el domicilio del emisor ni la cédula del receptor.` : ""}
      </p>` : `
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Este documento tiene validez tributaria conforme a la Ley 9069 de Costa Rica.
        Puede verificarlo en el portal de Hacienda con la clave numérica indicada.
      </p>`}
    </div>`;

  // El XML firmado ES el comprobante: un resumen en HTML no sustituye la entrega.
  // Se adjunta junto al acuse de Hacienda, que es lo que prueba la aceptación.
  const adjuntos = [];
  if (invoice.feXml) {
    adjuntos.push({
      filename: `${invoice.feNumber || invoice.invoiceNumber}.xml`,
      content: Buffer.from(invoice.feXml, "utf8").toString("base64"),
    });
  }
  if (invoice.feRespuestaXml) {
    adjuntos.push({
      filename: `Respuesta-${invoice.feNumber || invoice.invoiceNumber}.xml`,
      content: Buffer.from(invoice.feRespuestaXml, "utf8").toString("base64"),
    });
  }

  if (adjuntos.length === 0) {
    console.warn(
      `[FE] Factura ${invoice.invoiceNumber} se envía SIN XML adjunto: no quedó guardado. ` +
        "El receptor no recibe el comprobante con validez legal."
    );
  }

  // Copia al administrador: la contabilidad necesita el comprobante, y sirve de
  // respaldo si el paciente pierde el correo.
  const copiaAdmin = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  const destinatarios = [patientEmail];
  if (copiaAdmin && copiaAdmin !== patientEmail) destinatarios.push(copiaAdmin);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: destinatarios,
    subject: `${esPrueba ? "[PRUEBA] " : ""}Factura electrónica ${invoice.invoiceNumber} — Salud Mental Costa Rica`,
    html,
    ...(adjuntos.length > 0 ? { attachments: adjuntos } : {}),
  });

  if (error) console.error("[FE] Error enviando email de factura:", error);
  else {
    console.log(
      `[FE] Factura ${invoice.invoiceNumber} enviada a ${destinatarios.join(", ")} ` +
        `con ${adjuntos.length} adjunto(s).`
    );
  }
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

/**
 * Avisa al administrador que Hacienda rechazó un comprobante.
 *
 * Es la situación más cara de las que puede haber: el paciente ya pagó, la plata
 * entró, y no hay documento que respalde el ingreso. Cuanto más tarde se
 * descubra, más difícil de arreglar — el consecutivo sigue avanzando y la
 * declaración del mes se arma con lo que haya.
 */
async function sendFeRejectAlert(invoice, motivo) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!to || !process.env.RESEND_API_KEY) {
    console.error("[FE] No se pudo alertar el rechazo: falta ADMIN_ALERT_EMAIL o RESEND_API_KEY.");
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#b91c1c;">Hacienda rechazó una factura</h2>
      <p>El pago ya entró y <strong>no hay comprobante válido</strong> que lo respalde.
         Al paciente no se le envió nada.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 8px;color:#64748b;width:150px;">Factura</td>
            <td style="padding:6px 8px;font-weight:600;">${invoice.invoiceNumber}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Número FE</td>
            <td style="padding:6px 8px;">${invoice.feNumber || "—"}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b;">Total</td>
            <td style="padding:6px 8px;font-weight:600;">${invoice.total}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Cliente</td>
            <td style="padding:6px 8px;">${invoice.contactName || "—"}</td></tr>
      </table>
      <p style="padding:12px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;
                font-size:13px;color:#7f1d1d;white-space:pre-wrap;">${motivo || "Sin detalle."}</p>
      <p style="margin-top:16px;font-size:13px;">Acción: corregir lo que señala el mensaje y
         reenviar desde el panel. El XML enviado y la respuesta de Hacienda quedaron guardados
         en la factura.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `⚠ Hacienda rechazó la factura ${invoice.invoiceNumber}`,
    html,
  });

  if (error) console.error("[FE] Error enviando la alerta de rechazo:", error);
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
          productName: true,
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
  let feXml = null;
  let feRespuestaXml = null;
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
      feXml          = result.signedXml || null;
      feRespuestaXml = result.respuestaXml || null;
      realAcceptance = feStatus === "ACCEPTED";

      // Hacienda devuelve avisos incluso cuando acepta (p. ej. el -37 de datos
      // del emisor desactualizados en Tributación). Sin registrarlos, el problema
      // se repite en cada comprobante sin que nadie lo note.
      if (realAcceptance && result.avisos) {
        console.warn(`[FE] Factura ${invoiceId} aceptada CON AVISOS: ${result.avisos}`);
      }
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
    const consecutivo = extractConsecutivo(invoice.invoiceNumber);
    feNumber       = buildFeNumber(invoice.invoiceType, consecutivo);
    feClave        = buildFeClave(feNumber, invoice.invoiceDate);
    feStatus       = "ACCEPTED";
    feErrorMessage = "SIMULADO — sin validez tributaria";
    console.log(`[FE MOCK] Factura ${invoice.invoiceNumber} → feNumber=${feNumber} (SIMULADO, sin validez tributaria)`);
  }

  // Actualizar factura en BD.
  //
  // Los dos XML se persisten aunque Hacienda rechace: son el comprobante que se
  // adjunta al correo y, cuando algo falla, la única forma de ver qué se mandó
  // y qué contestaron. Se quedaban en memoria (solo llegaban a sendFeEmail) y
  // las columnas de la migración nunca se llenaban, así que cada rechazo había
  // que reproducirlo a mano para poder leerlo.
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { feNumber, feClave, feStatus, feErrorMessage, feXml, feRespuestaXml },
  });

  const enriched = { ...invoice, feNumber, feClave, feStatus, feXml, feRespuestaXml };

  // A quién se le manda el comprobante.
  //
  // En producción, solo si Hacienda aceptó: mandarle al paciente un documento
  // rechazado sería entregarle algo que no vale y que él no puede distinguir.
  //
  // En el sandbox se manda igual, porque ahí Hacienda rechaza SIEMPRE: su padrón
  // de contribuyentes es independiente del real y no reconoce ni el domicilio
  // del emisor (-37) ni la cédula del receptor (-38). Si se esperara la
  // aceptación, el recorrido completo no se podría probar nunca. El correo sale
  // marcado como prueba y diciendo que fue rechazado.
  // FE_REAL_API_URL en la condición no es redundante: sin ella, una factura del
  // modo mock (números simulados, jamás enviados a Hacienda) saldría por correo
  // como si fuera un comprobante. Ese es el guard FIS-01 y no puede aflojarse.
  const esSandbox = FE_REAL_API_URL && FE_EMISOR.ambiente !== "01";
  const seEntrega = realAcceptance || Boolean(esSandbox && feNumber);

  if (seEntrega) {
    sendFeEmail(enriched).catch((e) => console.error("[FE] Error en sendFeEmail:", e));
  }

  // Un rechazo real deja al paciente pagado y sin comprobante. Hasta ahora solo
  // quedaba en el log, así que nadie se enteraba hasta revisarlo a mano.
  if (feStatus === "REJECTED" && !esSandbox) {
    await sendFeRejectAlert(enriched, feErrorMessage).catch((e) =>
      console.error("[FE] Error alertando el rechazo:", e)
    );
  }

  return { feStatus, feNumber, feClave, feErrorMessage };
}
