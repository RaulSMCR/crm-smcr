import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function padNumber(value, digits) {
  return String(value).padStart(digits, "0");
}

function buildCreditNoteNumber(invoiceType, sequence, year) {
  const padded = padNumber(sequence.currentNumber, sequence.padding || 4);
  if (invoiceType === "SUPPLIER_CREDIT_NOTE") {
    return `${sequence.prefix || "NC-PROV/"}${sequence.year || year}/${padded}`;
  }
  return `${sequence.prefix || ""}${padded}`;
}

function toCreditType(originType) {
  if (originType === "SUPPLIER_INVOICE") return "SUPPLIER_CREDIT_NOTE";
  return "CUSTOMER_CREDIT_NOTE";
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
    const noteText = String(body.notes || "").trim();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const origin = await tx.invoice.findUnique({
        where: { id },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });

      if (!origin) return { error: { message: "Factura origen no encontrada.", status: 404 } };
      if (origin.status !== "PAID") {
        return { error: { message: "Solo se puede emitir rectificativa desde facturas pagadas.", status: 409 } };
      }
      if (!origin.lines.length) {
        return { error: { message: "La factura origen no tiene líneas.", status: 400 } };
      }

      const creditType = toCreditType(origin.invoiceType);
      const seq = await tx.invoiceSequence.update({
        where: { sequenceType: creditType },
        data: { currentNumber: { increment: 1 }, year: now.getFullYear() },
      });

      const creditNumber = buildCreditNoteNumber(creditType, seq, now.getFullYear());

      const creditLines = origin.lines.map((line) => ({
        productId: line.productId,
        serviceId: line.serviceId,
        productName: line.productName,
        description: line.description,
        cabysCode: line.cabysCode,
        accountCode: line.accountCode,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        unitPrice: Number(line.unitPrice) * -1,
        discountPercent: line.discountPercent,
        discountType: line.discountType,
        taxId: line.taxId,
        taxRate: line.taxRate,
        taxAmount: Number(line.taxAmount) * -1,
        lineSubtotal: Number(line.lineSubtotal) * -1,
        lineTotal: Number(line.lineTotal) * -1,
        sortOrder: line.sortOrder,
      }));

      const subtotal = creditLines.reduce((acc, line) => acc + Number(line.lineSubtotal), 0);
      const taxAmount = creditLines.reduce((acc, line) => acc + Number(line.taxAmount), 0);
      const total = subtotal + taxAmount;

      const credit = await tx.invoice.create({
        data: {
          invoiceNumber: creditNumber,
          invoiceType: creditType,
          feStatus: "PENDING",
          documentType: "NOTA_CREDITO",
          contactId: origin.contactId,
          professionalId: origin.professionalId,
          contactName: origin.contactName,
          contactIdNumber: origin.contactIdNumber,
          invoiceDate: now,
          dueDate: now,
          paymentDate: null,
          economicActivity: origin.economicActivity,
          paymentMethod: origin.paymentMethod,
          currency: origin.currency,
          supplierReference: origin.supplierReference,
          supplierEconomicActivity: origin.supplierEconomicActivity,
          subtotal,
          taxAmount,
          discountAmount: 0,
          total,
          amountPaid: 0,
          balance: total,
          status: "OPEN",
          originInvoiceId: origin.id,
          originDocument: origin.invoiceNumber,
          notes: noteText || `Nota de crédito generada desde ${origin.invoiceNumber}`,
          createdBy: String(auth.session.userId || auth.session.sub || ""),
          lines: { create: creditLines },
        },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });

      return { credit };
    });

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: result.error.status });
    }

    return NextResponse.json({
      id: result.credit.id,
      invoiceNumber: result.credit.invoiceNumber,
      invoiceType: result.credit.invoiceType,
      status: result.credit.status,
      originInvoiceId: result.credit.originInvoiceId,
      total: Number(result.credit.total),
    });
  } catch (error) {
    console.error("[invoices/:id/credit-note] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
