import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

// El cliente tiene que poder imprimir su factura: el correo llevaba solo los
// XML. Ahora va también el PDF, que sigue a la factura 0202 de referencia.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: vi.fn() } } }));

/** Todo el texto dibujado en el PDF (pdf-lib lo escribe en hexadecimal). */
async function textoDe(bytes) {
  const doc = await PDFDocument.load(bytes);
  let hex = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try { hex += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1"); } catch { /* no es texto */ }
    }
  }
  const legible = [...hex.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1")).join(" ");
  return legible;
}

// La 0205: emitida el 21-oct a las 22:50 CR, que en UTC ya es 22-oct.
const factura = {
  invoiceType: "CUSTOMER_INVOICE", invoiceNumber: "0205", status: "PAID",
  feNumber: "00100001010000000205", feClave: "50621102600310188566100100001010000000205199999999",
  feXml: "<FacturaElectronica/>", feStatus: "ACCEPTED", feAmbiente: "01",
  currency: "CRC", subtotal: 38461.54, discountAmount: 0, taxAmount: 1538.46, total: 40000,
  invoiceDate: new Date("2026-10-22T04:50:00Z"), paymentMethod: "sinpe",
  contactName: "Javier Alejandro Aguilera Azofeifa", contactIdNumber: "116610982", contactIdType: "01",
  contact: { email: "paciente@example.invalid" },
  lines: [{ productName: "Servicios Profesionales", description: "Psicoterapia psicoanalítica (adultos)", cabysCode: "9310100002600",
    quantity: 1, unitPrice: 38461.54, discountPercent: 0, taxRate: 4, taxAmount: 1538.46, lineSubtotal: 38461.54, lineTotal: 40000 }],
};
const EMISOR = { nombre: "Salud Mental Costa Rica Cinco Cero Seis S.A.", identificacion: "3101885661", correo: "contacto@example.invalid", ubicacion: { otrasSenas: "Curridabat" }, telefono: { numTelefono: "84282846" } };

describe("facturaPdf", () => {
  it("lleva lo que el cliente necesita para presentar la factura", async () => {
    const { facturaPdf } = await import("@/lib/fe/factura-pdf.js");
    const texto = await textoDe(await facturaPdf(factura, EMISOR));
    for (const esperado of [
      "FACTURA ELECTRÓNICA", "Nº 0205", "Fecha: 21/10/2026", "Salud Mental Costa Rica Cinco Cero Seis S.A.", "3101885661",
      // La marca: el PDF circula y la presenta.
      "Salud Mental", "Costa Rica", "saludmentalcostarica.com",
      "Javier Alejandro Aguilera Azofeifa", "116610982", "paciente@example.invalid",
      // La descripción larga se parte en renglones: se busca cada parte.
      "Servicios Profesionales", "Psicoterapia", "IVA (4%)", "CABYS 9310100002600",
      "CRC 38 461,54", "CRC 1 538,46", "CRC 40 000,00", "Medio de pago:", "SINPE Móvil",
      factura.feNumber, factura.feClave,
    ]) expect(texto).toContain(esperado);
    expect(texto).not.toContain("PRUEBAS");
  });

  it("muestra el descuento y su motivo cuando lo hay", async () => {
    const { facturaPdf } = await import("@/lib/fe/factura-pdf.js");
    const conDescuento = { ...factura, discountAmount: 1540, lines: [{ ...factura.lines[0], discountPercent: 3.85, discountType: "Tarifa social" }] };
    const texto = await textoDe(await facturaPdf(conDescuento, EMISOR));
    expect(texto).toContain("Descuentos");
    expect(texto).toContain("Descuento: Tarifa social");
  });

  it("marca el comprobante de pruebas y se niega a dibujar uno no aceptado", async () => {
    const { facturaPdf } = await import("@/lib/fe/factura-pdf.js");
    expect(await textoDe(await facturaPdf({ ...factura, feAmbiente: "02" }, EMISOR))).toContain("SIN VALIDEZ TRIBUTARIA");
    await expect(facturaPdf({ ...factura, feStatus: "REJECTED" }, EMISOR)).rejects.toThrow();
    await expect(facturaPdf({ ...factura, status: "CANCELLED" }, EMISOR)).rejects.toThrow();
  });

  it("no se rompe con un nombre fuera de Latin-1", async () => {
    const { facturaPdf } = await import("@/lib/fe/factura-pdf.js");
    await expect(facturaPdf({ ...factura, contactName: "Łukasz Żółć" }, EMISOR)).resolves.toBeInstanceOf(Buffer);
  });
});

describe("correo de la factura", () => {
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

  it("adjunta el PDF además del XML", async () => {
    const m = await capturar(factura);
    expect(m.attachments.map((a) => a.filename)).toEqual(["Factura-electrónica-0205.pdf", "00100001010000000205.xml"]);
    const pdf = Buffer.from(m.attachments[0].content, "base64");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("la fecha del correo es la de Costa Rica, no la del servidor", async () => {
    const m = await capturar(factura);
    expect(m.html).toContain("21 de octubre de 2026");
  });

  it("un comprobante rechazado no lleva PDF", async () => {
    const m = await capturar({ ...factura, feStatus: "REJECTED" });
    expect((m.attachments || []).some((a) => a.filename.endsWith(".pdf"))).toBe(false);
  });
});
