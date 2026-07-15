import { describe, expect, it } from "vitest";
import { splitTaxIncluded, computeInvoiceLine } from "../../src/lib/invoice-math.js";

describe("splitTaxIncluded", () => {
  it("desglosa 45,500 al 4%", () => {
    expect(splitTaxIncluded(45500, 4)).toEqual({ baseCents: 43750, taxCents: 1750 });
  });

  it("reconstruye siempre el total cuando hay redondeo", () => {
    const result = splitTaxIncluded(10001, 4);
    expect(result.baseCents + result.taxCents).toBe(10001);
  });

  it("permite una tasa de referencia de 13%", () => {
    const result = splitTaxIncluded(11300, 13);
    expect(result).toEqual({ baseCents: 10000, taxCents: 1300 });
  });
});

describe("computeInvoiceLine", () => {
  it("calcula descuento e IVA 4%", () => {
    expect(computeInvoiceLine({ quantity: 2, unitPrice: 10000, discountPercent: 10, taxRate: 4 })).toMatchObject({
      lineSubtotal: 18000,
      taxAmount: 720,
      lineTotal: 18720,
    });
  });

  it("calcula IVA 13% sin descuento", () => {
    expect(computeInvoiceLine({ quantity: 1, unitPrice: 10000, taxRate: 13 }).lineTotal).toBe(11300);
  });
});
