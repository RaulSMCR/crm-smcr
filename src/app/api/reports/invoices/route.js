import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeInvoiceType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;

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

function asNumber(value) {
  return Number(value || 0);
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
    const professionalId = String(searchParams.get("professionalId") || "").trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const groupBy = String(searchParams.get("groupBy") || "status").trim().toLowerCase();

    if (searchParams.get("type") && !type) {
      return NextResponse.json({ message: "type inválido." }, { status: 400 });
    }
    if (searchParams.get("status") && !status) {
      return NextResponse.json({ message: "status inválido." }, { status: 400 });
    }

    const where = {
      ...(type ? { invoiceType: type } : {}),
      ...(status ? { status } : {}),
      ...(professionalId ? { professionalId } : {}),
      ...(dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [totals, statusBuckets, typeBuckets] = await Promise.all([
      prisma.invoice.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
          total: true,
          amountPaid: true,
          balance: true,
        },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { total: true, amountPaid: true, balance: true },
      }),
      prisma.invoice.groupBy({
        by: ["invoiceType"],
        where,
        _count: { _all: true },
        _sum: { total: true, amountPaid: true, balance: true },
      }),
    ]);

    const groups = groupBy === "type" ? typeBuckets : statusBuckets;

    return NextResponse.json({
      filters: {
        type,
        status,
        professionalId: professionalId || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      metrics: {
        invoicesCount: totals._count?._all || 0,
        subtotal: asNumber(totals._sum?.subtotal),
        taxAmount: asNumber(totals._sum?.taxAmount),
        discountAmount: asNumber(totals._sum?.discountAmount),
        totalInvoiced: asNumber(totals._sum?.total),
        totalCollected: asNumber(totals._sum?.amountPaid),
        totalPending: asNumber(totals._sum?.balance),
      },
      groupedBy: groupBy === "type" ? "invoiceType" : "status",
      groups: groups.map((item) => ({
        key: item.status || item.invoiceType,
        count: item._count?._all || 0,
        total: asNumber(item._sum?.total),
        collected: asNumber(item._sum?.amountPaid),
        pending: asNumber(item._sum?.balance),
      })),
    });
  } catch (error) {
    console.error("[reports/invoices] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
