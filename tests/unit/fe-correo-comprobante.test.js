import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El correo que acompaña al comprobante tiene que nombrarlo por lo que es. Con
// el receptor extranjero no domiciliado (tipo 05) lo que sale es un Tiquete
// Electrónico, y el paciente —y la copia a contacto@— no pueden recibir un
// correo que diga «Factura electrónica» con un tiquete adjunto.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: vi.fn() } } }));

const venta = {
  invoiceType: "CUSTOMER_INVOICE",
  invoiceNumber: "0205",
  feNumber: "00100001010000000205",
  feClave: "50620102600310188566100100001010000000205100000000",
  feXml: "<FacturaElectronica/>",
  feStatus: "ACCEPTED",
  currency: "CRC",
  total: 1000,
  subtotal: 961.54,
  taxAmount: 38.46,
  invoiceDate: new Date("2026-10-20T18:00:00Z"),
  contactIdType: "01",
  contact: { email: "paciente@example.invalid" },
  lines: [],
};

let sendFeEmail;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("FE_AMBIENTE", "01");
  ({ sendFeEmail } = await import("@/lib/fe/submit.js"));
});
afterEach(() => vi.unstubAllEnvs());

const capturar = async (invoice) => {
  let mensaje;
  await sendFeEmail(invoice, { deliver: async (m) => { mensaje = m; return {}; } });
  return mensaje;
};

describe("sendFeEmail — el nombre del comprobante", () => {
  it("una venta a un receptor costarricense es una factura", async () => {
    const m = await capturar(venta);
    expect(m.subject).toMatch(/^Factura electrónica 0205/);
    expect(m.html).toContain("Factura electrónica emitida");
    expect(m.html).not.toContain("Tiquete");
  });

  it("una venta a un extranjero no domiciliado es un tiquete", async () => {
    const m = await capturar({
      ...venta,
      invoiceNumber: "TE/0001",
      feNumber: "00100001040000000001",
      contactIdType: "05",
    });
    expect(m.subject).toMatch(/^Tiquete electrónico TE\/0001/);
    expect(m.html).toContain("Tiquete electrónico emitido");
    expect(m.html).toContain("su tiquete electrónico emitido");
    expect(m.html).not.toContain("Factura electrónica");
  });

  it("el rechazo concuerda en género con el documento", async () => {
    // Solo pasa en el sandbox, que manda el comprobante aunque lo rechacen.
    vi.resetModules();
    vi.stubEnv("FE_AMBIENTE", "02");
    ({ sendFeEmail } = await import("@/lib/fe/submit.js"));

    expect((await capturar({ ...venta, feStatus: "REJECTED" })).html).toContain("Factura electrónica RECHAZADA");
    expect((await capturar({ ...venta, feStatus: "REJECTED", contactIdType: "05" })).html).toContain("Tiquete electrónico RECHAZADO");
  });
});
