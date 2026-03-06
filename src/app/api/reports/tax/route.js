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

    const [salesAgg, purchasesAgg, salesByTaxRate, purchasesByTaxRate] = await Promise.all([
      // IVA repercutido (facturas de cliente emitidas, excluye canceladas)
      prisma.invoice.aggregate({
        where: {
          invoiceType: { in: ["CUSTOMER_INVOICE", "CUSTOMER_CREDIT_NOTE"] },
          status: { not: "CANCELLED" },
          ...dateFilter,
        },
        _sum:   { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),
      // IVA soportado (facturas de proveedor, excluye canceladas)
      prisma.invoice.aggregate({
        where: {
          invoiceType: { in: ["SUPPLIER_INVOICE", "SUPPLIER_CREDIT_NOTE"] },
          status: { not: "CANCELLED" },
          ...dateFilter,
        },
        _sum:   { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),
      // Desglose de IVA de ventas por tasa impositiva (via líneas de factura)
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: {
          invoice: {
            invoiceType: { in: ["CUSTOMER_INVOICE", "CUSTOMER_CREDIT_NOTE"] },
            status: { not: "CANCELLED" },
            ...dateFilter,
          },
        },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
      // Desglose de IVA de compras por tasa impositiva
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: {
          invoice: {
            invoiceType: { in: ["SUPPLIER_INVOICE", "SUPPLIER_CREDIT_NOTE"] },
            status: { not: "CANCELLED" },
            ...dateFilter,
          },
        },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
    ]);

    const n = (v) => Number(v || 0);

    const ivaCobrado = n(salesAgg._sum?.taxAmount);
    const ivaPagado  = n(purchasesAgg._sum?.taxAmount);
    const ivaNeto    = ivaCobrado - ivaPagado;

    return NextResponse.json({
      filters: { dateFrom: dateFrom || null, dateTo: dateTo || null },

      sales: {
        invoicesCount:  salesAgg._count?._all || 0,
        subtotal:       n(salesAgg._sum?.subtotal),
        discountAmount: n(salesAgg._sum?.discountAmount),
        taxAmount:      ivaCobrado,
        total:          n(salesAgg._sum?.total),
        amountPaid:     n(salesAgg._sum?.amountPaid),
        byTaxRate: salesByTaxRate.map((row) => ({
          taxRate:     Number(row.taxRate),
          baseAmount:  n(row._sum?.lineSubtotal),
          taxAmount:   n(row._sum?.taxAmount),
        })),
      },

      purchases: {
        invoicesCount:  purchasesAgg._count?._all || 0,
        subtotal:       n(purchasesAgg._sum?.subtotal),
        discountAmount: n(purchasesAgg._sum?.discountAmount),
        taxAmount:      ivaPagado,
        total:          n(purchasesAgg._sum?.total),
        amountPaid:     n(purchasesAgg._sum?.amountPaid),
        byTaxRate: purchasesByTaxRate.map((row) => ({
          taxRate:    Number(row.taxRate),
          baseAmount: n(row._sum?.lineSubtotal),
          taxAmount:  n(row._sum?.taxAmount),
        })),
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
