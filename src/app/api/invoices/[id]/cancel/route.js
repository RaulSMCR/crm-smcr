import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";

export const dynamic = "force-dynamic";



export async function POST(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String((await params)?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, amountPaid: true, feStatus: true, invoiceType: true },
    });

    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    if (!["DRAFT", "OPEN"].includes(invoice.status)) {
      return NextResponse.json({ message: "Solo se puede cancelar una factura en borrador o abierta." }, { status: 409 });
    }
    // Cancelar acá cambia solo el CRM: ante Hacienda el comprobante aceptado
    // sigue vigente. El 23-nov-2026 se canceló así la 0222, aceptada y ya
    // enviada al paciente, y el CRM dejó de contar un ingreso que existe. Lo
    // aceptado se corrige con nota de crédito; una nota aceptada no se deshace.
    if (invoice.feStatus === "ACCEPTED") {
      const esNota = ["CUSTOMER_CREDIT_NOTE", "SUPPLIER_CREDIT_NOTE"].includes(invoice.invoiceType);
      return NextResponse.json({
        message: esNota
          ? "Hacienda aceptó esta nota de crédito: cancelarla acá no la anula ante Hacienda."
          : "Hacienda aceptó esta factura: cancelarla acá no la anula ante Hacienda. Corresponde una nota de crédito (Rectificativa).",
      }, { status: 409 });
    }
    if (Number(invoice.amountPaid) > 0) {
      return NextResponse.json({ message: "No se puede cancelar una factura con pagos registrados." }, { status: 409 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[invoices/:id/cancel] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
