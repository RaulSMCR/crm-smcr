import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function padNumber(value, digits) {
  return String(value).padStart(digits, "0");
}

function buildInvoiceNumber(invoiceType, sequence, now) {
  const n = sequence.currentNumber;
  const padded = padNumber(n, sequence.padding || 4);

  if (invoiceType === "SUPPLIER_INVOICE") {
    return `${sequence.prefix || "FACT/"}${sequence.year || now.getFullYear()}/${padded}`;
  }

  if (invoiceType === "SUPPLIER_CREDIT_NOTE") {
    return `${sequence.prefix || "NC-PROV/"}${sequence.year || now.getFullYear()}/${padded}`;
  }

  return `${sequence.prefix || ""}${padded}`;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  }
  return { session };
}

export async function POST(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!invoice) return { error: { message: "Factura no encontrada.", status: 404 } };
      if (invoice.status !== "DRAFT") {
        return { error: { message: "Solo se puede validar una factura en borrador.", status: 409 } };
      }
      if (!invoice.lines.length) {
        return { error: { message: "La factura no tiene líneas.", status: 400 } };
      }

      const DEFAULT_SEQ_PREFIX = {
        CUSTOMER_INVOICE: "",
        SUPPLIER_INVOICE: "FACT/",
        CUSTOMER_CREDIT_NOTE: "",
        SUPPLIER_CREDIT_NOTE: "NC-PROV/",
      };
      const sequence = await tx.invoiceSequence.upsert({
        where: { sequenceType: invoice.invoiceType },
        update: { currentNumber: { increment: 1 }, year: now.getFullYear() },
        create: { sequenceType: invoice.invoiceType, currentNumber: 1, year: now.getFullYear(), prefix: DEFAULT_SEQ_PREFIX[invoice.invoiceType] ?? "", padding: 4 },
      });

      const nextNumber = buildInvoiceNumber(invoice.invoiceType, sequence, now);
      const balance = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid));
      const nextStatus = balance <= 0 ? "PAID" : "OPEN";

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: nextNumber,
          status: nextStatus,
          balance,
          paymentDate: nextStatus === "PAID" ? now : null,
          feStatus: "PENDING",
        },
      });

      return { invoice: updated };
    });

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: result.error.status });
    }

    return NextResponse.json({
      id: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      status: result.invoice.status,
      balance: Number(result.invoice.balance),
    });
  } catch (error) {
    console.error("[invoices/:id/validate] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
