import { describe, expect, it } from "vitest";
import {
  firstIssueMessage,
  invoiceBodySchema,
  productBodySchema,
  professionalInvoiceSchema,
  settlementPeriodSchema,
  supplierAcceptanceSchema,
  validationMessage,
} from "@/lib/financial-schemas";

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

describe("periodo de liquidación", () => {
  it("acepta un período válido y un mismo día", () => {
    expect(settlementPeriodSchema.safeParse({ periodStart: "2026-07-01", periodEnd: "2026-07-31" }).success).toBe(true);
    expect(settlementPeriodSchema.safeParse({ periodStart: "2026-07-01", periodEnd: "2026-07-01" }).success).toBe(true);
  });

  it("rechaza un período invertido señalando el campo", () => {
    const result = settlementPeriodSchema.safeParse({ periodStart: "2026-07-31", periodEnd: "2026-07-01" });
    expect(result.success).toBe(false);
    expect(firstIssueMessage(result.error)).toContain("posterior");
  });

  // formData.get() devuelve null cuando el campo no viene: no debe caer en la época de 1970.
  it("rechaza fechas ausentes o vacías en vez de coercerlas a 1970", () => {
    expect(settlementPeriodSchema.safeParse({ periodStart: null, periodEnd: null }).success).toBe(false);
    expect(settlementPeriodSchema.safeParse({ periodStart: "", periodEnd: "" }).success).toBe(false);
    expect(settlementPeriodSchema.safeParse({ periodStart: "no-es-fecha", periodEnd: "2026-07-01" }).success).toBe(false);
  });
});

describe("factura de profesional", () => {
  const valid = {
    referenceNumber: "FAC-001",
    amount: 50000,
    fileUrl: "CVS/u1/factura.pdf",
    xmlUrl: "CVS/u1/factura.xml",
    supplierFeClave: "506" + "0".repeat(47),
  };

  it("acepta una factura completa y deja el período opcional", () => {
    const result = professionalInvoiceSchema.safeParse({ ...valid, periodStart: null, periodEnd: null });
    expect(result.success).toBe(true);
    expect(result.data.amount).toBe(50000);
  });

  it("mantiene los mensajes por campo y su precedencia", () => {
    const noRef = professionalInvoiceSchema.safeParse({ ...valid, referenceNumber: "  " });
    expect(firstIssueMessage(noRef.error)).toBe("El número de factura es obligatorio.");

    const noPdf = professionalInvoiceSchema.safeParse({ ...valid, fileUrl: "" });
    expect(firstIssueMessage(noPdf.error)).toBe("Debes subir el PDF de la factura.");

    const noXml = professionalInvoiceSchema.safeParse({ ...valid, xmlUrl: "" });
    expect(firstIssueMessage(noXml.error)).toBe("Debes subir el XML firmado de la factura.");
  });

  it("rechaza montos no numéricos, cero y negativos sin persistir NaN", () => {
    expect(professionalInvoiceSchema.safeParse({ ...valid, amount: "abc" }).success).toBe(false);
    expect(professionalInvoiceSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    expect(professionalInvoiceSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false);
    expect(firstIssueMessage(professionalInvoiceSchema.safeParse({ ...valid, amount: -100 }).error)).toBe(
      "El monto debe ser mayor a cero."
    );
  });
});

describe("aceptación de factura de proveedor", () => {
  it("solo admite ACCEPTED o REJECTED", () => {
    expect(supplierAcceptanceSchema.safeParse({ invoiceId: "inv1", acceptanceStatus: "ACCEPTED" }).success).toBe(true);
    expect(supplierAcceptanceSchema.safeParse({ invoiceId: "inv1", acceptanceStatus: "REJECTED" }).success).toBe(true);
    const bad = supplierAcceptanceSchema.safeParse({ invoiceId: "inv1", acceptanceStatus: "PENDING" });
    expect(bad.success).toBe(false);
    expect(firstIssueMessage(bad.error)).toBe("Estado de aceptación inválido.");
  });
});
