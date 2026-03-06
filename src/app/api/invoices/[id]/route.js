import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function computeLine(lineInput) {
  const quantity = round2(toNumber(lineInput.quantity, 1));
  const unitPrice = round2(toNumber(lineInput.unitPrice, 0));
  const discountPercent = round2(toNumber(lineInput.discountPercent, 0));
  const taxRate = round2(toNumber(lineInput.taxRate, 0));

  const gross = round2(quantity * unitPrice);
  const discount = round2(gross * (discountPercent / 100));
  const lineSubtotal = round2(gross - discount);
  const taxAmount = round2(lineSubtotal * (taxRate / 100));
  const lineTotal = round2(lineSubtotal + taxAmount);

  return {
    quantity,
    unitPrice,
    discountPercent,
    taxRate,
    taxAmount,
    lineSubtotal,
    lineTotal,
  };
}

function mapInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    feStatus: invoice.feStatus,
    feNumber: invoice.feNumber,
    feClave: invoice.feClave,
    contactId: invoice.contactId,
    professionalId: invoice.professionalId,
    professionalName: invoice.professional?.user?.name || null,
    contactName: invoice.contactName,
    contactIdNumber: invoice.contactIdNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    paymentDate: invoice.paymentDate,
    economicActivity: invoice.economicActivity,
    paymentMethod: invoice.paymentMethod,
    currency: invoice.currency,
    supplierReference: invoice.supplierReference,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balance: Number(invoice.balance),
    lines: (invoice.lines || []).map((line) => ({
      id: line.id,
      productId: line.productId,
      serviceId: line.serviceId,
      taxId: line.taxId,
      productName: line.productName,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountPercent: Number(line.discountPercent),
      taxRate: Number(line.taxRate),
      taxAmount: Number(line.taxAmount),
      lineSubtotal: Number(line.lineSubtotal),
      lineTotal: Number(line.lineTotal),
      sortOrder: line.sortOrder,
    })),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        professional: { select: { user: { select: { name: true } } } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!invoice) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });

    return NextResponse.json(mapInvoice(invoice));
  } catch (error) {
    console.error("[invoices/:id] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const current = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) return NextResponse.json({ message: "Factura no encontrada." }, { status: 404 });
    if (current.status !== "DRAFT") {
      return NextResponse.json({ message: "Solo se puede editar una factura en borrador." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const professionalId = body.professionalId ? String(body.professionalId) : "";

    if (professionalId) {
      const profExists = await prisma.professionalProfile.findUnique({
        where: { id: professionalId },
        select: { id: true },
      });
      if (!profExists) {
        return NextResponse.json({ message: "professionalId no existe." }, { status: 404 });
      }
    }

    const computedLines = lines.map((line, index) => {
      const calc = computeLine(line);
      return {
        productId: line.productId ? String(line.productId) : null,
        serviceId: line.serviceId ? String(line.serviceId) : null,
        productName: String(line.productName || "").trim() || "Ítem",
        description: line.description ? String(line.description) : null,
        cabysCode: line.cabysCode ? String(line.cabysCode) : null,
        accountCode: line.accountCode ? String(line.accountCode) : null,
        quantity: calc.quantity,
        unitOfMeasure: line.unitOfMeasure ? String(line.unitOfMeasure) : "Unidad(es)",
        unitPrice: calc.unitPrice,
        discountPercent: calc.discountPercent,
        discountType: line.discountType ? String(line.discountType) : null,
        taxId: line.taxId ? String(line.taxId) : null,
        taxRate: calc.taxRate,
        taxAmount: calc.taxAmount,
        lineSubtotal: calc.lineSubtotal,
        lineTotal: calc.lineTotal,
        sortOrder: Number.isInteger(line.sortOrder) ? line.sortOrder : index,
      };
    });

    const subtotal = round2(computedLines.reduce((acc, line) => acc + line.lineSubtotal, 0));
    const taxAmount = round2(computedLines.reduce((acc, line) => acc + line.taxAmount, 0));
    const gross = round2(
      computedLines.reduce((acc, line) => acc + round2(line.quantity * line.unitPrice), 0)
    );
    const discountAmount = round2(gross - subtotal);
    const total = round2(subtotal + taxAmount);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          contactId: body.contactId ? String(body.contactId) : undefined,
          professionalId: body.professionalId !== undefined ? (professionalId || null) : undefined,
          contactName: body.contactName !== undefined ? String(body.contactName || "") : undefined,
          contactIdNumber:
            body.contactIdNumber !== undefined ? String(body.contactIdNumber || "") : undefined,
          invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : undefined,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
          economicActivity:
            body.economicActivity !== undefined ? String(body.economicActivity || "") : undefined,
          paymentMethod: body.paymentMethod !== undefined ? String(body.paymentMethod || "") : undefined,
          currency: body.currency !== undefined ? String(body.currency || "CRC") : undefined,
          supplierReference:
            body.supplierReference !== undefined ? String(body.supplierReference || "") : undefined,
          supplierEconomicActivity:
            body.supplierEconomicActivity !== undefined
              ? String(body.supplierEconomicActivity || "")
              : undefined,
          notes: body.notes !== undefined ? String(body.notes || "") : undefined,
          subtotal,
          taxAmount,
          discountAmount,
          total,
          balance: round2(total - Number(body.amountPaid || 0)),
          lines: computedLines.length ? { create: computedLines } : undefined,
        },
        include: {
          professional: { select: { user: { select: { name: true } } } },
          lines: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    return NextResponse.json(mapInvoice(updated));
  } catch (error) {
    console.error("[invoices/:id] PUT error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
