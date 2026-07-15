import { describe, expect, it } from "vitest";
import { invoiceBodySchema, productBodySchema, validationMessage } from "@/lib/financial-schemas";

describe("financial input schemas", () => {
  it("rechaza quantity no numérico", () => {
    const result = invoiceBodySchema.safeParse({ lines: [{ quantity: "abc", unitPrice: 100 }] });
    expect(result.success).toBe(false);
    expect(validationMessage(result.error)).toContain("quantity");
  });

  it("acepta números como strings y normaliza después de validar", () => {
    const result = invoiceBodySchema.safeParse({ lines: [{ quantity: "2", unitPrice: "1000", taxRate: "4" }] });
    expect(result.success).toBe(true);
    expect(result.data.lines[0].quantity).toBe(2);
  });

  it("rechaza precio de producto negativo", () => {
    expect(productBodySchema.safeParse({ name: "Servicio", salePrice: -1 }).success).toBe(false);
  });
});
