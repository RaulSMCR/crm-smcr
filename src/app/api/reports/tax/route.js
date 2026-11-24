// src/app/api/reports/tax/route.js
// Reporte de IVA: repercutido (ventas) vs soportado (compras) para un período.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { COMPROBANTE_DE_VENTA_DECLARADO, calcularIvaDelPeriodo, filtroFechasCr } from "@/lib/fiscal-periodo";

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

    // Días en hora de Costa Rica, dateTo inclusivo. Ver src/lib/fiscal-periodo.js.
    let dateFilter;
    try { dateFilter = filtroFechasCr(dateFrom, dateTo); }
    catch { return NextResponse.json({ message: "Fechas inválidas: usá AAAA-MM-DD." }, { status: 400 }); }

    const [salesAgg, salesCreditsAgg, purchasesAgg, purchaseCreditsAgg, purchasesPendingAgg, salesByTaxRate, salesCreditsByTaxRate, purchasesByTaxRate, purchaseCreditsByTaxRate] = await Promise.all([
      prisma.invoice.aggregate({
        where: { invoiceType: "CUSTOMER_INVOICE", ...COMPROBANTE_DE_VENTA_DECLARADO, ...dateFilter },
        _sum:   { subtotal: true, taxAmount: true, discountAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { invoiceType: "CUSTOMER_CREDIT_NOTE", ...COMPROBANTE_DE_VENTA_DECLARADO, ...dateFilter },
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
        where: { invoice: { invoiceType: "CUSTOMER_INVOICE", ...COMPROBANTE_DE_VENTA_DECLARADO, ...dateFilter } },
        _sum: { lineSubtotal: true, taxAmount: true },
      }),
      prisma.invoiceLine.groupBy({
        by: ["taxRate"],
        where: { invoice: { invoiceType: "CUSTOMER_CREDIT_NOTE", ...COMPROBANTE_DE_VENTA_DECLARADO, ...dateFilter } },
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
    // Las notas de crédito del CRM se guardan en negativo (las de proveedor
    // pueden venir en positivo del XML): se restan por su valor absoluto. Antes
    // se restaba el negativo y la nota SUMABA ingreso e IVA (23-nov-2026, 0100).
    const nc = (v) => Math.abs(Number(v || 0));

    const ivaCobrado = n(salesAgg._sum?.taxAmount) - nc(salesCreditsAgg._sum?.taxAmount);
    const ivaPagado  = n(purchasesAgg._sum?.taxAmount) - nc(purchaseCreditsAgg._sum?.taxAmount);
    const netRows = (invoices, credits) => {
      const map = new Map();
      for (const row of invoices) map.set(Number(row.taxRate), { taxRate: Number(row.taxRate), baseAmount: n(row._sum?.lineSubtotal), taxAmount: n(row._sum?.taxAmount) });
      for (const row of credits) {
        const key = Number(row.taxRate); const current = map.get(key) || { taxRate: key, baseAmount: 0, taxAmount: 0 };
        current.baseAmount -= nc(row._sum?.lineSubtotal); current.taxAmount -= nc(row._sum?.taxAmount); map.set(key, current);
      }
      return [...map.values()];
    };
    // El IVA soportado no se acredita entero: solo hasta la tarifa de las
    // ventas (compra al 13 %, venta al 4 % → crédito del 4 %). Ver la D-104 de
    // septiembre de 2026 y calcularIvaDelPeriodo.
    const d104 = calcularIvaDelPeriodo({ ventas: salesByTaxRate, notasVentas: salesCreditsByTaxRate, compras: purchasesByTaxRate, notasCompras: purchaseCreditsByTaxRate });
    const ivaNeto    = ivaCobrado - d104.creditoFiscal;

    return NextResponse.json({
      filters: { dateFrom: dateFrom || null, dateTo: dateTo || null },

      sales: {
        invoicesCount:  salesAgg._count?._all || 0,
        subtotal:       n(salesAgg._sum?.subtotal) - nc(salesCreditsAgg._sum?.subtotal),
        discountAmount: n(salesAgg._sum?.discountAmount) - nc(salesCreditsAgg._sum?.discountAmount),
        taxAmount:      ivaCobrado,
        total:          n(salesAgg._sum?.total) - nc(salesCreditsAgg._sum?.total),
        amountPaid:     n(salesAgg._sum?.amountPaid) - nc(salesCreditsAgg._sum?.amountPaid),
        byTaxRate: netRows(salesByTaxRate, salesCreditsByTaxRate),
        creditNotes: { invoicesCount: salesCreditsAgg._count?._all || 0, subtotal: n(salesCreditsAgg._sum?.subtotal), taxAmount: n(salesCreditsAgg._sum?.taxAmount), total: n(salesCreditsAgg._sum?.total) },
      },

      purchases: {
        invoicesCount:  purchasesAgg._count?._all || 0,
        subtotal:       n(purchasesAgg._sum?.subtotal) - nc(purchaseCreditsAgg._sum?.subtotal),
        discountAmount: n(purchasesAgg._sum?.discountAmount) - nc(purchaseCreditsAgg._sum?.discountAmount),
        taxAmount:      ivaPagado,
        total:          n(purchasesAgg._sum?.total) - nc(purchaseCreditsAgg._sum?.total),
        amountPaid:     n(purchasesAgg._sum?.amountPaid) - nc(purchaseCreditsAgg._sum?.amountPaid),
        byTaxRate: netRows(purchasesByTaxRate, purchaseCreditsByTaxRate),
        creditNotes: { invoicesCount: purchaseCreditsAgg._count?._all || 0, subtotal: n(purchaseCreditsAgg._sum?.subtotal), taxAmount: n(purchaseCreditsAgg._sum?.taxAmount), total: n(purchaseCreditsAgg._sum?.total) },
        purchasesPendingAcceptance: { invoicesCount: purchasesPendingAgg._count?._all || 0, taxAmount: n(purchasesPendingAgg._sum?.taxAmount), total: n(purchasesPendingAgg._sum?.total) },
      },

      summary: {
        ivaCobrado,
        ivaPagado,
        creditoFiscal: d104.creditoFiscal,
        gastoParaUtilidades: d104.gastoParaUtilidades,
        tarifaAplicada: d104.tarifaAplicada,
        requiereRevision: d104.requiereRevision,
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
