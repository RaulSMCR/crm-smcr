import { describe, expect, it, vi } from "vitest";

// Noviembre 2026: la 0221 (₡430 000, IVA ₡16 538,46) la anula la nota 0100,
// guardada en negativo, y la 0222 (₡30 000, IVA ₡1 153,85) la reemplaza. Antes
// se restaba el negativo y la nota sumaba IVA en vez de descontarlo.
const m = vi.hoisted(() => ({ aggregate: vi.fn(), groupBy: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { invoice: { aggregate: m.aggregate }, invoiceLine: { groupBy: m.groupBy } } }));
vi.mock("@/lib/auth", () => ({ getSession: async () => ({ role: "ADMIN" }) }));

const { GET } = await import("@/app/api/reports/tax/route");
const suma = (taxAmount, subtotal, total) => ({ _sum: { taxAmount, subtotal, total, discountAmount: 0, amountPaid: total }, _count: { _all: 1 } });

describe("reporte de IVA con una nota de crédito guardada en negativo", () => {
  it("la nota descuenta el IVA de la factura que anula", async () => {
    m.aggregate.mockImplementation(async ({ where }) => {
      if (where.invoiceType === "CUSTOMER_INVOICE") return suma(16538.46 + 1153.85, 413461.54 + 28846.15, 460000);
      if (where.invoiceType === "CUSTOMER_CREDIT_NOTE") return suma(-16538.46, -413461.54, -430000);
      return suma(0, 0, 0);
    });
    m.groupBy.mockImplementation(async ({ where }) => (where.invoice.invoiceType === "CUSTOMER_CREDIT_NOTE"
      ? [{ taxRate: 4, _sum: { lineSubtotal: -413461.54, taxAmount: -16538.46 } }]
      : where.invoice.invoiceType === "CUSTOMER_INVOICE" ? [{ taxRate: 4, _sum: { lineSubtotal: 442307.69, taxAmount: 17692.31 } }] : []));
    const body = await (await GET(new Request("http://x/api/reports/tax"))).json();
    expect(body.sales.taxAmount).toBeCloseTo(1153.85, 2);
    expect(body.sales.total).toBeCloseTo(30000, 2);
    expect(body.sales.byTaxRate[0].taxAmount).toBeCloseTo(1153.85, 2);
  });

  it("solo cuenta las notas aceptadas por Hacienda", async () => {
    await GET(new Request("http://x/api/reports/tax"));
    const filtro = m.aggregate.mock.calls.map(([q]) => q.where).find((w) => w.invoiceType === "CUSTOMER_CREDIT_NOTE");
    expect(filtro).toMatchObject({ feStatus: "ACCEPTED", status: { not: "CANCELLED" } });
  });
});
