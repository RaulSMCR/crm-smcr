import { describe, expect, it } from "vitest";
import { splitTaxIncluded } from "../../src/lib/invoice-math.js";
import { validateSupplierFeClave } from "../../src/lib/supplier-invoice.js";

describe("factura de proveedor", () => {
  it("valida largo y cédula embebida", () => {
    const clave = `506${"000310123456"}${"0".repeat(35)}`;
    expect(clave).toHaveLength(50);
    expect(validateSupplierFeClave(clave, "310123456").ok).toBe(true);
    expect(validateSupplierFeClave("123", "310123456").ok).toBe(false);
  });
  it("desglosa IVA incluido al 4%", () => {
    expect(splitTaxIncluded(10400, 4)).toEqual({ baseCents: 10000, taxCents: 400 });
  });
});
