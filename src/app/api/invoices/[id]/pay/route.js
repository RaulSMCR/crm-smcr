import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  }
  return { session };
}

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
