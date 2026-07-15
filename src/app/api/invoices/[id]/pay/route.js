import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { markSettlementPaid } from "@/actions/settlement-actions";
import { round2, toNumber } from "@/lib/invoice-math";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const paymentAmount = round2(toNumber(body.amount, 0));
    if (paymentAmount <= 0) {
      return NextResponse.json({ message: "amount debe ser mayor a 0." }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, total: true, amountPaid: true },
    });

    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    if (!["OPEN", "PAID"].includes(invoice.status)) {
      return NextResponse.json({ message: "Solo se puede pagar una factura abierta." }, { status: 409 });
    }

    const nextAmountPaid = round2(Number(invoice.amountPaid) + paymentAmount);
    const nextBalance = round2(Math.max(0, Number(invoice.total) - nextAmountPaid));
    const nextStatus = nextBalance <= 0 ? "PAID" : "OPEN";

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: nextAmountPaid,
        balance: nextBalance,
        status: nextStatus,
        paymentDate: nextStatus === "PAID" ? new Date() : null,
      },
    });

    if (updated.status === "PAID") await markSettlementPaid(updated.id);

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      amountPaid: Number(updated.amountPaid),
      balance: Number(updated.balance),
    });
  } catch (error) {
    console.error("[invoices/:id/pay] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
