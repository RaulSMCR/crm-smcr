import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/invoice-sequence", () => ({ siguienteNumeroDeFactura: vi.fn(async () => "0216") }));

import { createPaymentInvoice } from "@/lib/onvo/payment-invoice";

function txFalso({ multa = null, facturaMulta = null } = {}) {
  return {
    paymentTransaction: { findFirst: vi.fn(async () => multa) },
    invoice: {
      findFirst: vi.fn(async () => facturaMulta),
      create: vi.fn(async () => ({ id: "inv1" })),
    },
  };
}

const cobro = {
  id: "txSaldo", type: "BALANCE_50", amount: "15000.00", taxRate: 4, currency: "CRC",
  appointmentId: "cita1", patientId: "pac", professionalId: "pro",
  appointment: { date: new Date("2026-11-10T01:00:00Z"), service: { id: "s", cabysCode: "x", taxId: "t" } },
  patient: { name: "Paciente", identification: "604120029" },
  professional: { academicDegree: "licenciado", user: { name: "Raúl Olmedo" } },
};

const detalle = (tx) => tx.invoice.create.mock.calls[0][0].data.lines.create.description;

describe("saldo de una sesión cuya otra mitad entró como multa", () => {
  it("nombra la factura de la otra mitad", async () => {
    const tx = txFalso({ multa: { id: "txMulta" }, facturaMulta: { invoiceNumber: "0214" } });
    await createPaymentInvoice(tx, cobro);
    expect(tx.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { originDocument: "ONVO_TX:txMulta", invoiceType: "CUSTOMER_INVOICE" },
    }));
    expect(detalle(tx)).toMatch(/^Saldo 50% de la consulta del .+ con Lic\. Raúl Olmedo\. La otra mitad se pagó aparte y consta en la factura 0214\.$/);
  });

  it("sin multa, el detalle es el de siempre", async () => {
    const tx = txFalso();
    await createPaymentInvoice(tx, cobro);
    expect(detalle(tx)).not.toMatch(/otra mitad/);
  });
});
