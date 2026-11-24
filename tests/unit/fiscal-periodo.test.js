import { describe, expect, it, vi, beforeEach } from "vitest";
import { filtroFechasCr, limitesMesCr, mesActualCr } from "@/lib/fiscal-periodo";

// Fechas siempre explícitas en UTC: la prueba no puede depender del reloj ni
// de la zona de la máquina, que es justo lo que escondía el error.
const utc = (s) => new Date(`${s}Z`);

describe("mes fiscal en hora de Costa Rica", () => {
  it("octubre 2026 va de la medianoche CR del 1 a la del 1 de noviembre", () => {
    const { start, end } = limitesMesCr(2026, 10);
    expect(start.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("una factura del 31 a las 19:00 CR es del mes, no del siguiente", () => {
    const factura = utc("2026-11-01T01:00:00"); // 31-oct 19:00 CR
    const oct = limitesMesCr(2026, 10);
    const nov = limitesMesCr(2026, 11);
    expect(factura >= oct.start && factura < oct.end).toBe(true);
    expect(factura >= nov.start && factura < nov.end).toBe(false);
  });

  it("diciembre cierra en enero del año siguiente", () => {
    expect(limitesMesCr(2026, 12).end.toISOString()).toBe("2027-01-01T06:00:00.000Z");
  });

  it("rechaza un período sin sentido", () => {
    expect(() => limitesMesCr(2026, 13)).toThrow("PERIODO_FISCAL_INVALIDO");
    expect(() => limitesMesCr("x", 1)).toThrow("PERIODO_FISCAL_INVALIDO");
  });

  it("el mes actual es el de CR aunque UTC ya esté en el siguiente", () => {
    expect(mesActualCr(utc("2026-12-01T03:00:00"))).toEqual({ year: 2026, month: 11 });
    expect(mesActualCr(utc("2026-12-01T07:00:00"))).toEqual({ year: 2026, month: 12 });
  });

  it("el rango de días incluye todo el día final en hora CR", () => {
    const { invoiceDate } = filtroFechasCr("2026-10-01", "2026-10-31");
    expect(invoiceDate.gte.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(invoiceDate.lt.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    expect(invoiceDate.lte).toBeUndefined();
  });

  it("sin fechas no filtra y con fechas mal formadas falla", () => {
    expect(filtroFechasCr(null, null)).toEqual({});
    expect(() => filtroFechasCr("2026-02-31", null)).toThrow("FECHA_INVALIDA");
    expect(() => filtroFechasCr("31/10/2026", null)).toThrow("FECHA_INVALIDA");
  });
});

const m = vi.hoisted(() => ({ aggregate: vi.fn(), groupBy: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { aggregate: m.aggregate },
    invoiceLine: { groupBy: m.groupBy },
    fiscalPeriod: { findUnique: m.findUnique, upsert: m.upsert },
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: async () => ({ role: "ADMIN" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { GET: reporteIva } = await import("@/app/api/reports/tax/route");
const { closeFiscalPeriod } = await import("@/actions/fiscal-actions");
const { GET: exportD104 } = await import("@/app/api/admin/fiscal-export/route");

const form = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.set(k, v); return f; };
const suma = (taxAmount, subtotal, total) => ({ _sum: { taxAmount, subtotal, total, discountAmount: 0, amountPaid: total }, _count: { _all: 1 } });

beforeEach(() => {
  m.aggregate.mockReset().mockResolvedValue(suma(0, 0, 0));
  m.groupBy.mockReset().mockResolvedValue([]);
  m.findUnique.mockReset();
  m.upsert.mockReset().mockImplementation(async ({ create }) => create);
});

describe("lo que entra en la declaración", () => {
  it("el reporte de IVA solo suma ventas aceptadas por Hacienda (la 0204 rechazada no)", async () => {
    await reporteIva(new Request("http://x/api/reports/tax?dateFrom=2026-10-01&dateTo=2026-10-31"));
    const filtro = m.aggregate.mock.calls.map(([q]) => q.where).find((w) => w.invoiceType === "CUSTOMER_INVOICE");
    expect(filtro.feStatus).toBe("ACCEPTED");
    expect(filtro.invoiceDate.gte.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(filtro.invoiceDate.lt.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("el reporte de IVA rechaza fechas que no sean AAAA-MM-DD", async () => {
    const res = await reporteIva(new Request("http://x/api/reports/tax?dateFrom=octubre"));
    expect(res.status).toBe(400);
  });

  it("el cierre usa el mes CR y solo lo aceptado", async () => {
    m.findUnique.mockResolvedValue(null);
    await closeFiscalPeriod(form({ year: "2026", month: "10" }));
    const filtro = m.aggregate.mock.calls.map(([q]) => q.where).find((w) => w.invoiceType === "CUSTOMER_INVOICE");
    expect(filtro.feStatus).toBe("ACCEPTED");
    expect(filtro.invoiceDate.gte.toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });

  it("noviembre 2026: la base de ventas descuenta la nota 0100, igual que el IVA", async () => {
    m.findUnique.mockResolvedValue(null);
    m.aggregate.mockImplementation(async ({ where }) => {
      if (where.invoiceType === "CUSTOMER_INVOICE") return suma(41346.15, 1033653.85, 1075000);
      if (where.invoiceType === "CUSTOMER_CREDIT_NOTE") return suma(-16538.46, -413461.54, -430000);
      return suma(0, 0, 0);
    });
    const { period } = await closeFiscalPeriod(form({ year: "2026", month: "11" }));
    expect(period.snapshot.baseVentas).toBeCloseTo(620192.31, 2);
    expect(period.ivaDebito).toBeCloseTo(24807.69, 2);

    m.findUnique.mockResolvedValue(period);
    const csv = await (await exportD104(new Request("http://x/api/admin/fiscal-export?year=2026&month=11"))).text();
    expect(csv).toContain('"Ventas netas","620192.31","24807.69"');
  });

  it("el export recalcula la base neta en un cierre que no la guardó", async () => {
    m.findUnique.mockResolvedValue({
      ivaNeto: 24807.69,
      snapshot: {
        sales: { _sum: { subtotal: "1033653.85" } }, salesCredits: { _sum: { subtotal: "-413461.54" } },
        purchases: { _sum: { subtotal: null } }, purchaseCredits: { _sum: { subtotal: null } },
        ivaDebito: 24807.69, ivaCredito: 0,
      },
    });
    const csv = await (await exportD104(new Request("http://x/api/admin/fiscal-export?year=2026&month=11"))).text();
    expect(csv).toContain('"Ventas netas","620192.31","24807.69"');
  });

  it("un período ya presentado no se vuelve a cerrar", async () => {
    m.findUnique.mockResolvedValue({ status: "FILED" });
    const r = await closeFiscalPeriod(form({ year: "2026", month: "10" }));
    expect(r.success).toBe(false);
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
