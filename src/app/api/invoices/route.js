import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { invoiceBodySchema, validationMessage } from "@/lib/financial-schemas";
import { round2 } from "@/lib/invoice-math";
import { resolverLineas } from "@/lib/invoice-draft-lines";
import { datosFacturacionDe } from "@/lib/fiscal-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

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
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const parsed = invoiceBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: validationMessage(parsed.error) }, { status: 400 });
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
        email: true,
        identification: true,
        billingName: true,
        billingIdType: true,
        billingIdNumber: true,
        billingEmail: true,
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

    // El receptor de una venta sale de los datos de facturación del paciente —los
    // mismos que usan ONVO y los pagos manuales—, con su tipo de identificación.
    // Se exige acá y no al emitir: un borrador sin receptor no se puede validar.
    let receptor = null;
    if (invoiceType === "CUSTOMER_INVOICE") {
      receptor = datosFacturacionDe(contact);
      if (!receptor.nombre || receptor.nombre.length < 3 || !receptor.identificacion) {
        return NextResponse.json(
          { message: "El cliente no tiene nombre e identificación fiscal completos. Complete sus datos de facturación antes de facturarle." },
          { status: 409 }
        );
      }
    }

    const resueltas = await resolverLineas(prisma, lines);
    if (!resueltas.ok) {
      return NextResponse.json({ message: resueltas.message }, { status: resueltas.status });
    }
    const computedLines = resueltas.lines;

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
        ...(receptor
          ? {
              contactName: receptor.nombre,
              contactIdNumber: receptor.identificacion,
              contactIdType: receptor.tipoIdentificacion,
            }
          : {
              contactName: String(body.contactName || contact.name || ""),
              contactIdNumber: String(body.contactIdNumber || contact.identification || ""),
            }),
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
        // Era `session`, que en este handler no existe: cada borrador terminaba en
        // un 500 desde que se escribió esta ruta.
        createdBy: String(auth.session.userId || auth.session.sub || ""),
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
