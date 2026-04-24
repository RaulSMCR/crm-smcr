// src/app/api/invoices/[id]/submit-fe/route.js
// Envía la factura al sistema de Factura Electrónica (FE) de Costa Rica.
// Delega toda la lógica FE al módulo compartido src/lib/fe/submit.js.
//
// POST /api/invoices/:id/submit-fe
// Auth: ADMIN
// La factura debe estar en estado OPEN o PAID (validada).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { submitInvoiceToFe } from "@/lib/fe/submit";

export const dynamic = "force-dynamic";

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
      select: { id: true, status: true, feStatus: true, feNumber: true, feClave: true, invoiceNumber: true },
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

    if (invoice.feStatus === "ACCEPTED" && invoice.feNumber) {
      return NextResponse.json({
        message:        "La factura ya fue aceptada por FE.",
        feNumber:       invoice.feNumber,
        feClave:        invoice.feClave,
        feStatus:       invoice.feStatus,
        feErrorMessage: null,
      });
    }

    const result = await submitInvoiceToFe(id);

    return NextResponse.json({
      id,
      invoiceNumber:  invoice.invoiceNumber,
      feNumber:       result.feNumber,
      feClave:        result.feClave,
      feStatus:       result.feStatus,
      feErrorMessage: result.feErrorMessage,
      mock:           !process.env.FE_API_URL,
    });
  } catch (error) {
    console.error("[invoices/:id/submit-fe] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
