// src/app/api/invoices/[id]/submit-fe/route.js
// Envía la factura al sistema de Factura Electrónica (FE) de Costa Rica.
// Si FE_API_URL está configurada usa la integración real con Hacienda.
// En caso contrario (o si PLACETOPAY_MOCK=true) usa el modo simulado para testing.
//
// POST /api/invoices/:id/submit-fe
// Auth: ADMIN
// La factura debe estar en estado OPEN o PAID (validada).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

async function sendFeEmail({ invoice, updated }) {
  const patientEmail = invoice.contact?.email;
  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const fmt = new Intl.NumberFormat("es-CR", { style: "currency", currency: invoice.currency || "CRC", maximumFractionDigits: 0 });
  const total = fmt.format(Number(invoice.total));
  const date  = new Date(invoice.invoiceDate).toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });

  const lineRows = (invoice.lines || []).map((l) => {
    const prod = l.product?.name || "Servicio";
    const unitFmt = fmt.format(Number(l.unitPrice));
    const lineFmt = fmt.format(Number(l.lineTotal));
    return `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px 4px;">${prod}${l.description ? ` — ${l.description}` : ""}</td>
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
        <tr><td style="padding:6px 8px;color:#64748b;width:160px;">Número de factura</td><td style="padding:6px 8px;font-weight:600;">${updated.invoiceNumber}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Número FE (Hacienda)</td><td style="padding:6px 8px;font-weight:600;">${updated.feNumber || "—"}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b;">Clave numérica</td><td style="padding:6px 8px;font-size:12px;word-break:break-all;">${updated.feClave || "—"}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Fecha</td><td style="padding:6px 8px;">${date}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b;">Total</td><td style="padding:6px 8px;font-weight:700;font-size:16px;">${total}</td></tr>
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
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">Este documento tiene validez tributaria conforme a la Ley 9069 de Costa Rica. Puede ser verificado en el portal de Hacienda con la clave numérica indicada.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to:   patientEmail,
    subject: `Factura electrónica ${updated.invoiceNumber} — Salud Mental Costa Rica`,
    html,
  });

  if (error) console.error("[FE] Error enviando email al paciente:", error);
  else console.log(`[FE] Email de FE enviado a ${patientEmail} para factura ${updated.invoiceNumber}`);
}

const FE_REAL_API_URL = process.env.FE_API_URL || null;

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  return { session };
}

export async function POST(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true, status: true, feStatus: true, invoiceNumber: true,
        invoiceType: true, invoiceDate: true, dueDate: true,
        feNumber: true, feClave: true,
        contactName: true, contactIdNumber: true,
        economicActivity: true, paymentMethod: true, currency: true,
        subtotal: true, taxAmount: true, discountAmount: true, total: true,
        notes: true, originDocument: true,
        originInvoice: { select: { invoiceDate: true } },
        contact: { select: { email: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            quantity: true, unitPrice: true, discountPercent: true,
            taxRate: true, taxAmount: true, lineSubtotal: true, lineTotal: true,
            description: true,
            product: {
              select: { name: true, cabysCode: true, saleUom: true },
            },
          },
        },
      },
    });

    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });

    if (invoice.status === "DRAFT") {
      return NextResponse.json(
        { message: "La factura debe estar validada (OPEN o PAID) para enviarse a FE." },
        { status: 409 }
      );
    }
    if (invoice.status === "CANCELLED") {
      return NextResponse.json({ message: "No se puede enviar a FE una factura cancelada." }, { status: 409 });
    }

    // Si ya fue aceptada, no reenviar
    if (invoice.feStatus === "ACCEPTED" && invoice.feNumber) {
      return NextResponse.json({
        message:       "La factura ya fue aceptada por FE.",
        feNumber:      invoice.feNumber,
        feClave:       invoice.feClave,
        feStatus:      invoice.feStatus,
        feErrorMessage: null,
      });
    }

    let feNumber, feClave, feStatus, feErrorMessage;

    if (FE_REAL_API_URL) {
      // ── Integración real con API de Hacienda CR ───────────────────────────
      try {
        const { submitToHacienda } = await import("@/lib/fe/client.js");
        const result = await submitToHacienda(invoice, invoice.lines);
        feNumber      = result.feNumber;
        feClave       = result.feClave;
        feStatus      = result.feStatus;       // "ACCEPTED" | "REJECTED"
        feErrorMessage = result.feErrorMessage || null;
      } catch (feErr) {
        console.error("[FE] Error enviando a Hacienda:", feErr);
        return NextResponse.json(
          { message: `Error al enviar a Hacienda: ${feErr.message}` },
          { status: 502 }
        );
      }
    } else {
      // ── Modo mock: genera FE simulada ────────────────────────────────────
      const { buildFeNumber, buildFeClave, extractConsecutivo } = await import("@/lib/fe/xml.js");
      const { TIPO_DOC_MAP } = await import("@/lib/fe/config.js");
      const tipoDoc    = TIPO_DOC_MAP[invoice.invoiceType] || "01";
      const consecutivo = extractConsecutivo(invoice.invoiceNumber);
      feNumber   = buildFeNumber(invoice.invoiceType, consecutivo);
      feClave    = buildFeClave(tipoDoc, feNumber, invoice.invoiceDate);
      feStatus   = "ACCEPTED";
      feErrorMessage = null;
      console.log(`[FE MOCK] Factura ${invoice.invoiceNumber} → feNumber=${feNumber}`);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { feNumber, feClave, feStatus, feErrorMessage },
      select: { id: true, invoiceNumber: true, feNumber: true, feClave: true, feStatus: true, feErrorMessage: true },
    });

    // Enviar email al paciente solo si la FE fue aceptada
    if (feStatus === "ACCEPTED") {
      sendFeEmail({ invoice, updated }).catch((e) =>
        console.error("[FE] Error en sendFeEmail:", e)
      );
    }

    return NextResponse.json({
      id:             updated.id,
      invoiceNumber:  updated.invoiceNumber,
      feNumber:       updated.feNumber,
      feClave:        updated.feClave,
      feStatus:       updated.feStatus,
      feErrorMessage: updated.feErrorMessage,
      mock:           !FE_REAL_API_URL,
    });
  } catch (error) {
    console.error("[invoices/:id/submit-fe] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
