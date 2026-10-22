import { describe, expect, it, vi } from "vitest";
import {
  faltaParaEmitir,
  problemaDeDescuento,
  resolverLineas,
} from "../../src/lib/invoice-draft-lines.js";

const SERVICIO = { id: "svc-1", title: "Psicoterapia", cabysCode: "9310100002600", taxId: "iva-4-salud", tax: { rate: 4 } };

function dbCon(servicios = [SERVICIO]) {
  return { service: { findMany: vi.fn(async () => servicios) } };
}

describe("problemaDeDescuento", () => {
  it("no pide nada si no hay descuento", () => {
    expect(problemaDeDescuento({ discountPercent: 0 })).toBeNull();
    expect(problemaDeDescuento({})).toBeNull();
  });

  it("exige el motivo cuando hay descuento", () => {
    expect(problemaDeDescuento({ discountPercent: 10 })).toMatch(/motivo/);
    expect(problemaDeDescuento({ discountPercent: 10, discountType: "  " })).toMatch(/motivo/);
    expect(problemaDeDescuento({ discountPercent: 10, discountType: "Tarifa social" })).toBeNull();
  });

  it("rechaza el 100 % y los motivos de más de 80 caracteres", () => {
    expect(problemaDeDescuento({ discountPercent: 100, discountType: "Gratis" })).toMatch(/menor al 100/);
    expect(problemaDeDescuento({ discountPercent: 5, discountType: "x".repeat(81) })).toMatch(/80/);
  });
});

describe("resolverLineas", () => {
  it("toma el CABYS, el impuesto y la tasa del servicio, no del cuerpo", async () => {
    const r = await resolverLineas(dbCon(), [
      { serviceId: "svc-1", productName: "Servicios Profesionales", unitPrice: 38461.54, taxRate: 13, cabysCode: "000", taxId: "otro" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.lines[0]).toMatchObject({ cabysCode: "9310100002600", taxId: "iva-4-salud", taxRate: 4, taxAmount: 1538.46, lineTotal: 40000 });
  });

  it("reproduce la factura 0202: 40.000 con 3,85 % de descuento y 4 % de IVA", async () => {
    const r = await resolverLineas(dbCon(), [
      { serviceId: "svc-1", unitPrice: 40000, discountPercent: 3.85, discountType: "Ajuste comercial" },
    ]);
    expect(r.lines[0]).toMatchObject({ lineSubtotal: 38460, taxAmount: 1538.4, lineTotal: 39998.4, discountType: "Ajuste comercial" });
  });

  it("no guarda un motivo si no hubo descuento", async () => {
    const r = await resolverLineas(dbCon(), [{ serviceId: "svc-1", unitPrice: 1000, discountType: "sobra" }]);
    expect(r.lines[0].discountType).toBeNull();
  });

  it("rechaza el descuento sin motivo y el servicio inexistente", async () => {
    const sinMotivo = await resolverLineas(dbCon(), [{ serviceId: "svc-1", unitPrice: 1000, discountPercent: 5 }]);
    expect(sinMotivo).toMatchObject({ ok: false, status: 400 });
    const inexistente = await resolverLineas(dbCon([]), [{ serviceId: "nada", unitPrice: 1000 }]);
    expect(inexistente).toMatchObject({ ok: false, status: 404 });
  });
});

describe("faltaParaEmitir", () => {
  const borrador = {
    contactName: "Javier Aguilera",
    contactIdNumber: "116610982",
    lines: [{ cabysCode: "9310100002600", discountPercent: 0 }],
  };

  it("deja pasar un borrador completo", () => {
    expect(faltaParaEmitir(borrador)).toBeNull();
    expect(faltaParaEmitir({ ...borrador, lines: [{ service: { cabysCode: "9310100002600" } }] })).toBeNull();
  });

  it("detiene la validación antes de tomar el consecutivo", () => {
    expect(faltaParaEmitir({ ...borrador, contactName: "" })).toMatch(/nombre/);
    expect(faltaParaEmitir({ ...borrador, contactIdNumber: "" })).toMatch(/identificación/);
    expect(faltaParaEmitir({ ...borrador, lines: [{ discountPercent: 0 }] })).toMatch(/CABYS/);
    expect(faltaParaEmitir({ ...borrador, lines: [{ cabysCode: "1", discountPercent: 5 }] })).toMatch(/motivo/);
  });
});
