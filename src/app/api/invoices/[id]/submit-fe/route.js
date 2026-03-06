// src/app/api/invoices/[id]/submit-fe/route.js
// Envía la factura al sistema de Factura Electrónica (FE) de Costa Rica.
// En modo mock (cuando no hay credenciales FE reales), simula la aceptación
// y genera un feNumber y feClave plausibles para testing.
//
// POST /api/invoices/:id/submit-fe
// Auth: ADMIN
// La factura debe estar en estado OPEN (validada).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Cuando FE_REAL_API_URL no está configurada, se usa el mock automáticamente.
const FE_REAL_API_URL = process.env.FE_API_URL || null;

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  return { session };
}

/**
 * Genera un número FE de 20 dígitos según el formato de Hacienda CR:
 * Sucursal(3) + Terminal(5) + TipoDoc(2) + Consecutivo(10)
 */
function buildFeNumber(invoiceType, consecutivo) {
  const tipoDoc = {
    CUSTOMER_INVOICE:       "01",
    CUSTOMER_CREDIT_NOTE:   "03",
    SUPPLIER_INVOICE:       "08",
    SUPPLIER_CREDIT_NOTE:   "09",
  }[invoiceType] || "01";

  const consec = String(consecutivo).padStart(10, "0");
  return `00100001${tipoDoc}${consec}`;
}

/**
 * Genera una Clave FE de 50 dígitos (simulada para testing).
 * Formato real: País(3) + Fecha(6) + Cédula(12) + Consecutivo(20) + Situación(1) + Random(8)
 */
function buildFeClave(feNumber, invoiceDate) {
  const d    = new Date(invoiceDate);
  const date = [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getFullYear()).slice(2),
  ].join(""); // DDMMYY

  const pais       = "506";                          // CR
  const cedula     = "310188566100".padStart(12, "0"); // Cédula empresa (12 dígitos)
  const consec20   = feNumber.padStart(20, "0");      // Consecutivo 20 dígitos
  const situacion  = "1";                            // Normal
  const security   = String(Math.floor(Math.random() * 99999999)).padStart(8, "0");

  const clave = `${pais}${date}${cedula}${consec20}${situacion}${security}`;
  return clave.slice(0, 50).padEnd(50, "0");
}

/** Extrae el número de consecutivo de un invoiceNumber (ej: "0152" → 152, "FACT/2025/0007" → 7) */
function extractConsecutivo(invoiceNumber) {
  const parts = String(invoiceNumber).split("/");
  return parseInt(parts[parts.length - 1] || "1", 10) || 1;
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
        invoiceType: true, invoiceDate: true, feNumber: true, feClave: true,
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
        message: "La factura ya fue aceptada por FE.",
        feNumber: invoice.feNumber,
        feClave:  invoice.feClave,
        feStatus: invoice.feStatus,
      });
    }

    let feNumber, feClave, feStatus;

    if (FE_REAL_API_URL) {
      // ── Integración real con API de Hacienda CR (placeholder) ────────────
      // TODO: implementar cuando lleguen las credenciales FE
      // const result = await submitToHaciendaFE({ invoice, ... });
      // feNumber = result.clave; feClave = result.claveAcceso; feStatus = "ACCEPTED";
      return NextResponse.json(
        { message: "Integración FE real pendiente. Configure FE_API_URL cuando disponga de las credenciales." },
        { status: 501 }
      );
    }

    // ── Modo mock: genera FE simulada ────────────────────────────────────────
    const consecutivo = extractConsecutivo(invoice.invoiceNumber);
    feNumber  = buildFeNumber(invoice.invoiceType, consecutivo);
    feClave   = buildFeClave(feNumber, invoice.invoiceDate);
    feStatus  = "ACCEPTED";

    console.log(`[FE MOCK] Factura ${invoice.invoiceNumber} → feNumber=${feNumber}`);

    const updated = await prisma.invoice.update({
      where: { id },
      data: { feNumber, feClave, feStatus },
      select: { id: true, invoiceNumber: true, feNumber: true, feClave: true, feStatus: true },
    });

    return NextResponse.json({
      id:            updated.id,
      invoiceNumber: updated.invoiceNumber,
      feNumber:      updated.feNumber,
      feClave:       updated.feClave,
      feStatus:      updated.feStatus,
      mock:          !FE_REAL_API_URL,
    });
  } catch (error) {
    console.error("[invoices/:id/submit-fe] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
