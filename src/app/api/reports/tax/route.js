// src/app/api/reports/tax/route.js
// Reporte de IVA: repercutido (ventas) vs soportado (compras) para un período.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Acción no permitida." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");

    const dateFilter =
      dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
            },
          }
        : {};

    const [salesAgg, salesCreditsAgg, purchasesAgg, purchaseCreditsAgg, purchasesPendingAgg, salesByTaxRate, salesCreditsByTaxRate, purchasesByTaxRate, purchaseCreditsByTaxRate] = await Promise.all([
      prisma.invoice.aggregate({
        where: { invoiceType: "CUSTOMER_INVOICE", status: { not: "CANCELLED" }, ...dateFilter },
        _sum:   { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { invoiceType: "CUSTOMER_CREDIT_NOTE", status: { not: "CANCELLED" }, ...dateFilter },
        _sum: { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true }, _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { invoiceType: "SUPPLIER_INVOICE", acceptanceStatus: "ACCEPTED", status: { not: "CANCELLED" }, ...dateFilter },
        _sum:   { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { invoiceType: "SUPPLIER_CREDIT_NOTE", acceptanceStatus: "ACCEPTED", status: { not: "CANCELLED" }, ...dateFilter },
        _sum: { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true }, _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { invoiceType: "SUPPLIER_INVOICE", acceptanceStatus: { not: "ACCEPTED" }, status: { not: "CANCELLED" }, ...dateFilter },
        _sum: { total: true, taxAmount: true }, _count: { _all: true },
      }),
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: { invoice: { invoiceType: "CUSTOMER_INVOICE", status: { not: "CANCELLED" }, ...dateFilter } },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: { invoice: { invoiceType: "CUSTOMER_CREDIT_NOTE", status: { not: "CANCELLED" }, ...dateFilter } },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: { invoice: { invoiceType: "SUPPLIER_INVOICE", acceptanceStatus: "ACCEPTED", status: { not: "CANCELLED" }, ...dateFilter } },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: { invoice: { invoiceType: "SUPPLIER_CREDIT_NOTE", acceptanceStatus: "ACCEPTED", status: { not: "CANCELLED" }, ...dateFilter } },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
    ]);

    const n = (v) => Number(v || 0);

    const ivaCobrado = n(salesAgg._sum?.taxAmount) - n(salesCreditsAgg._sum?.taxAmount);
    const ivaPagado  = n(purchasesAgg._sum?.taxAmount) - n(purchaseCreditsAgg._sum?.taxAmount);
    const netRows = (invoices, credits) => {
      const map = new Map();
      for (const row of invoices) map.set(Number(row.taxRate), { taxRate: Number(row.taxRate), baseAmount: n(row._sum?.lineSubtotal), taxAmount: n(row._sum?.taxAmount) });
      for (const row of credits) {
        const key = Number(row.taxRate); const current = map.get(key) || { taxRate: key, baseAmount: 0, taxAmount: 0 };
        current.baseAmount -= n(row._sum?.lineSubtotal); current.taxAmount -= n(row._sum?.taxAmount); map.set(key, current);
      }
      return [...map.values()];
    };
    const ivaNeto    = ivaCobrado - ivaPagado;

    return NextResponse.json({
      filters: { dateFrom: dateFrom || null, dateTo: dateTo || null },

      sales: {
        invoicesCount:  salesAgg._count?._all || 0,
        subtotal:       n(salesAgg._sum?.subtotal) - n(salesCreditsAgg._sum?.subtotal),
        discountAmount: n(salesAgg._sum?.discountAmount) - n(salesCreditsAgg._sum?.discountAmount),
        taxAmount:      ivaCobrado,
        total:          n(salesAgg._sum?.total) - n(salesCreditsAgg._sum?.total),
        amountPaid:     n(salesAgg._sum?.amountPaid) - n(salesCreditsAgg._sum?.amountPaid),
        byTaxRate: netRows(salesByTaxRate, salesCreditsByTaxRate),
        creditNotes: { invoicesCount: salesCreditsAgg._count?._all || 0, subtotal: n(salesCreditsAgg._sum?.subtotal), taxAmount: n(salesCreditsAgg._sum?.taxAmount), total: n(salesCreditsAgg._sum?.total) },
      },

      purchases: {
        invoicesCount:  purchasesAgg._count?._all || 0,
        subtotal:       n(purchasesAgg._sum?.subtotal) - n(purchaseCreditsAgg._sum?.subtotal),
        discountAmount: n(purchasesAgg._sum?.discountAmount) - n(purchaseCreditsAgg._sum?.discountAmount),
        taxAmount:      ivaPagado,
        total:          n(purchasesAgg._sum?.total) - n(purchaseCreditsAgg._sum?.total),
        amountPaid:     n(purchasesAgg._sum?.amountPaid) - n(purchaseCreditsAgg._sum?.amountPaid),
        byTaxRate: netRows(purchasesByTaxRate, purchaseCreditsByTaxRate),
        creditNotes: { invoicesCount: purchaseCreditsAgg._count?._all || 0, subtotal: n(purchaseCreditsAgg._sum?.subtotal), taxAmount: n(purchaseCreditsAgg._sum?.taxAmount), total: n(purchaseCreditsAgg._sum?.total) },
        purchasesPendingAcceptance: { invoicesCount: purchasesPendingAgg._count?._all || 0, taxAmount: n(purchasesPendingAgg._sum?.taxAmount), total: n(purchasesPendingAgg._sum?.total) },
      },

      summary: {
        ivaCobrado,
        ivaPagado,
        ivaNeto,
        // Si ivaNeto > 0: hay IVA a pagar a Hacienda. Si < 0: hay crédito fiscal.
        position: ivaNeto >= 0 ? "payable" : "refundable",
        label:    ivaNeto >= 0
          ? `IVA a pagar: ₡${Math.abs(ivaNeto).toLocaleString("es-CR")}`
          : `Crédito fiscal: ₡${Math.abs(ivaNeto).toLocaleString("es-CR")}`,
      },
    });
  } catch (error) {
    console.error("[reports/tax] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
