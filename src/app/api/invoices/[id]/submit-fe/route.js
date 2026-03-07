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

export const dynamic = "force-dynamic";

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
