import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";

export const dynamic = "force-dynamic";



export async function POST(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, amountPaid: true },
    });

    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    if (!["DRAFT", "OPEN"].includes(invoice.status)) {
      return NextResponse.json({ message: "Solo se puede cancelar una factura en borrador o abierta." }, { status: 409 });
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
