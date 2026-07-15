// src/app/api/reports/profit-loss/route.js
// Reporte de Ganancias y Pérdidas (Estado de Resultados simplificado).
// Ingresos = facturas de cliente pagadas o abiertas (devengadas).
// Gastos   = facturas de proveedor pagadas o abiertas.
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
    // basis: "cash" (solo pagadas) | "accrual" (pagadas + abiertas). Default: accrual
    const basis    = searchParams.get("basis") === "cash" ? "cash" : "accrual";

    const incomeStatuses  = basis === "cash" ? ["PAID"] : ["PAID", "OPEN"];
    const expenseStatuses = basis === "cash" ? ["PAID"] : ["PAID", "OPEN"];

    const dateFilter =
      dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
            },
          }
        : {};

    const [incomeAgg, incomeCreditsAgg, expenseAgg, expenseCreditsAgg, incomeProfessional, incomeCreditsProfessional] = await Promise.all([
      // Ingresos: facturas de cliente
      prisma.invoice.aggregate({
        where: {
          invoiceType: "CUSTOMER_INVOICE",
          status: { in: incomeStatuses },
          ...dateFilter,
        },
        _sum:   { subtotal: true, taxAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),

      prisma.invoice.aggregate({
        where: { invoiceType: "CUSTOMER_CREDIT_NOTE", status: { in: incomeStatuses }, ...dateFilter },
        _sum: { subtotal: true, taxAmount: true, total: true, amountPaid: true }, _count: { _all: true },
      }),

      // Gastos: facturas de proveedor
      prisma.invoice.aggregate({
        where: {
          invoiceType: "SUPPLIER_INVOICE",
          status: { in: expenseStatuses },
          ...dateFilter,
        },
        _sum:   { subtotal: true, taxAmount: true, total: true, amountPaid: true },
        _count: { _all: true },
      }),

      prisma.invoice.aggregate({
        where: { invoiceType: "SUPPLIER_CREDIT_NOTE", status: { in: expenseStatuses }, ...dateFilter },
        _sum: { subtotal: true, taxAmount: true, total: true, amountPaid: true }, _count: { _all: true },
      }),

      // Desglose de ingresos por profesional
      prisma.invoice.groupBy({
        by: ["professionalId"],
        where: {
          invoiceType: "CUSTOMER_INVOICE",
          status: { in: incomeStatuses },
          professionalId: { not: null },
          ...dateFilter,
        },
        _sum:   { total: true, amountPaid: true },
        _count: { _all: true },
      }),

      prisma.invoice.groupBy({
        by: ["professionalId"],
        where: { invoiceType: "CUSTOMER_CREDIT_NOTE", status: { in: incomeStatuses }, professionalId: { not: null }, ...dateFilter },
        _sum: { total: true, amountPaid: true }, _count: { _all: true },
      }),
    ]);

    const n = (v) => Number(v || 0);

    // Para el desglose por profesional, buscar nombres
    const professionalIds = [...incomeProfessional, ...incomeCreditsProfessional].map((r) => r.professionalId).filter(Boolean);
    const professionals   = professionalIds.length
      ? await prisma.professionalProfile.findMany({
          where: { id: { in: professionalIds } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const profMap = new Map(professionals.map((p) => [p.id, p.user?.name || "Sin nombre"]));

    const income   = n(incomeAgg._sum?.subtotal) - n(incomeCreditsAgg._sum?.subtotal);
    const expenses = n(expenseAgg._sum?.subtotal) - n(expenseCreditsAgg._sum?.subtotal);
    const grossProfit  = income - expenses;
    const netIncome    = grossProfit; // Sin más deducciones por ahora

    return NextResponse.json({
      filters: {
        dateFrom: dateFrom || null,
        dateTo:   dateTo   || null,
        basis,
      },

      income: {
        invoicesCount: incomeAgg._count?._all || 0,
        subtotal:      income,
        taxAmount:     n(incomeAgg._sum?.taxAmount) - n(incomeCreditsAgg._sum?.taxAmount),
        totalWithTax:  n(incomeAgg._sum?.total) - n(incomeCreditsAgg._sum?.total),
        collected:     n(incomeAgg._sum?.amountPaid) - n(incomeCreditsAgg._sum?.amountPaid),
        creditNotes: { invoicesCount: incomeCreditsAgg._count?._all || 0, total: n(incomeCreditsAgg._sum?.total) },
        byProfessional: incomeProfessional.map((row) => {
          const credit = incomeCreditsProfessional.find((item) => item.professionalId === row.professionalId);
          return {
          professionalId: row.professionalId,
          professionalName: profMap.get(row.professionalId) || "Sin nombre",
          invoicesCount:  row._count?._all || 0,
          collected:      n(row._sum?.amountPaid) - n(credit?._sum?.amountPaid),
          total:          n(row._sum?.total) - n(credit?._sum?.total),
        };
        }),
      },

      expenses: {
        invoicesCount: expenseAgg._count?._all || 0,
        subtotal:      expenses,
        taxAmount:     n(expenseAgg._sum?.taxAmount) - n(expenseCreditsAgg._sum?.taxAmount),
        totalWithTax:  n(expenseAgg._sum?.total) - n(expenseCreditsAgg._sum?.total),
        paid:          n(expenseAgg._sum?.amountPaid) - n(expenseCreditsAgg._sum?.amountPaid),
        creditNotes: { invoicesCount: expenseCreditsAgg._count?._all || 0, total: n(expenseCreditsAgg._sum?.total) },
      },

      summary: {
        grossProfit,
        netIncome,
        profitMargin: income > 0 ? Math.round((grossProfit / income) * 10000) / 100 : 0,
        isProfit: grossProfit >= 0,
      },
    });
  } catch (error) {
    console.error("[reports/profit-loss] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
