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

function normalizeInvoiceType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "CUSTOMER_INVOICE";

  const map = {
    CUSTOMER: "CUSTOMER_INVOICE",
    SUPPLIER: "SUPPLIER_INVOICE",
    CUSTOMER_INVOICE: "CUSTOMER_INVOICE",
    SUPPLIER_INVOICE: "SUPPLIER_INVOICE",
    CUSTOMER_CREDIT_NOTE: "CUSTOMER_CREDIT_NOTE",
    SUPPLIER_CREDIT_NOTE: "SUPPLIER_CREDIT_NOTE",
  };

  return map[raw] || null;
}

function normalizeInvoiceStatus(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  const valid = new Set(["DRAFT", "OPEN", "PAID", "CANCELLED"]);
  return valid.has(raw) ? raw : null;
}

function buildDraftInvoiceNumber(type) {
  const stamp = Date.now();
  if (type === "SUPPLIER_INVOICE") return `DRAFT-SUP-${stamp}`;
  if (type === "CUSTOMER_CREDIT_NOTE") return `DRAFT-CN-${stamp}`;
  if (type === "SUPPLIER_CREDIT_NOTE") return `DRAFT-SCN-${stamp}`;
  return `DRAFT-CUS-${stamp}`;
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
    contactId: invoice.contactId,
    appointmentId: invoice.appointmentId,
    professionalId: invoice.professionalId,
    professionalName: invoice.professional?.user?.name || null,
    contactName: invoice.contactName,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balance: Number(invoice.balance),
    lines: (invoice.lines || []).map((line) => ({
      id: line.id,
      productName: line.productName,
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
  };
}

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = normalizeInvoiceType(searchParams.get("type"));
    const status = normalizeInvoiceStatus(searchParams.get("status"));
    const contactId = String(searchParams.get("contactId") || "").trim();
    const professionalId = String(searchParams.get("professionalId") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    if (searchParams.get("type") && !type) {
      return NextResponse.json({ message: "type inválido." }, { status: 400 });
    }
    if (searchParams.get("status") && !status) {
      return NextResponse.json({ message: "status inválido." }, { status: 400 });
    }

    const where = {
      ...(type ? { invoiceType: type } : {}),
      ...(status ? { status } : {}),
      ...(contactId ? { contactId } : {}),
      ...(professionalId ? { professionalId } : {}),
      ...(dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { contactIdNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: { invoiceDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          professional: {
            select: { user: { select: { name: true } } },
          },
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
    ]);

    return NextResponse.json({
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      items: items.map(mapInvoice),
    });
  } catch (error) {
    console.error("[invoices] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const invoiceType = normalizeInvoiceType(body.invoiceType);
    const contactId = String(body.contactId || "").trim();
    const appointmentId = String(body.appointmentId || "").trim();
    const professionalId = String(body.professionalId || "").trim();
    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(invoiceDate);
    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (!invoiceType) {
      return NextResponse.json({ message: "invoiceType inválido." }, { status: 400 });
    }
    if (!contactId) {
      return NextResponse.json({ message: "contactId es requerido." }, { status: 400 });
    }
    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ message: "Fechas inválidas." }, { status: 400 });
    }

    const contact = await prisma.user.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        name: true,
        identification: true,
      },
    });
    if (!contact) {
      return NextResponse.json({ message: "contactId no existe." }, { status: 404 });
    }

    if (professionalId) {
      const profExists = await prisma.professionalProfile.findUnique({
        where: { id: professionalId },
        select: { id: true },
      });
      if (!profExists) {
        return NextResponse.json({ message: "professionalId no existe." }, { status: 404 });
      }
    }

    if (appointmentId) {
      const appointmentExists = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true },
      });
      if (!appointmentExists) {
        return NextResponse.json({ message: "appointmentId no existe." }, { status: 404 });
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
    const amountPaid = 0;
    const balance = total;

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: String(body.invoiceNumber || "").trim() || buildDraftInvoiceNumber(invoiceType),
        invoiceType,
        feStatus: "PENDING",
        documentType: String(body.documentType || "FACTURA_ELECTRONICA"),
        contactId: contact.id,
        appointmentId: appointmentId || null,
        professionalId: professionalId || null,
        contactName: String(body.contactName || contact.name || ""),
        contactIdNumber: String(body.contactIdNumber || contact.identification || ""),
        invoiceDate,
        dueDate,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        economicActivity: body.economicActivity ? String(body.economicActivity) : null,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : "transfer",
        currency: String(body.currency || "CRC"),
        supplierReference: body.supplierReference ? String(body.supplierReference) : null,
        supplierEconomicActivity: body.supplierEconomicActivity
          ? String(body.supplierEconomicActivity)
          : null,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        amountPaid,
        balance,
        status: "DRAFT",
        originInvoiceId: body.originInvoiceId ? String(body.originInvoiceId) : null,
        originDocument: body.originDocument ? String(body.originDocument) : null,
        notes: body.notes ? String(body.notes) : null,
        createdBy: String(session.userId || session.sub || ""),
        lines: computedLines.length ? { create: computedLines } : undefined,
      },
      include: {
        professional: {
          select: { user: { select: { name: true } } },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(mapInvoice(created), { status: 201 });
  } catch (error) {
    console.error("[invoices] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
