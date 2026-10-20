import { beforeEach, describe, expect, it, vi } from "vitest";
import { esReemision, origenDeReemision, reemitirFacturaRechazada } from "@/lib/fe/reemision";
import { extractConsecutivo } from "@/lib/fe/xml.js";

// La 0203 real: pagada por ONVO, rechazada por Hacienda.
const ORIGINAL = {
  id: "inv-0203",
  invoiceNumber: "0203",
  invoiceType: "CUSTOMER_INVOICE",
  documentType: "FACTURA_ELECTRONICA",
  status: "PAID",
  feStatus: "REJECTED",
  feClave: "50619102600310188566100100001010000000203124547935",
  feNumber: "00100001010000000203",
  feErrorMessage: "La firma del comprobante electrónico no es válida (El certificado empleado se encuentra revocado.)",
  contactId: "contact-1",
  appointmentId: "appt-1",
  professionalId: "pro-1",
  contactName: "Paciente",
  contactIdNumber: "95930281",
  contactIdType: "05",
  economicActivity: null,
  paymentMethod: "transfer",
  cuentaDeposito: null,
  currency: "CRC",
  invoiceDate: new Date("2026-10-19T20:43:54Z"),
  paymentDate: new Date("2026-09-18T23:46:52Z"),
  subtotal: 961.54,
  taxAmount: 38.46,
  discountAmount: 0,
  total: 1000,
  amountPaid: 1000,
  balance: 0,
  originDocument: "ONVO_TX:tx-1",
  notes: "ONVO Pay",
  createdBy: "admin-1",
  lines: [{
    productId: null, serviceId: "svc-1", productName: "Servicios profesionales", description: "Adelanto 50%",
    cabysCode: "9310100002600", accountCode: null, quantity: 1, unitOfMeasure: "Sp", unitPrice: 961.54,
    discountPercent: 0, discountType: null, taxId: "iva-4-salud", taxRate: 4, taxAmount: 38.46,
    lineSubtotal: 961.54, lineTotal: 1000, sortOrder: 0,
  }],
  _count: { creditNotes: 0 },
};

const AHORA = new Date("2026-10-20T15:00:00Z");

// El perfil del contacto, ya corregido: la factura rechazada dice tipo 05, pero
// la persona cargó su DIMEX. La reemisión tiene que tomar ESTE dato.
const CONTACTO_CORREGIDO = {
  id: "contact-1",
  name: "Carolina Courtis",
  email: "paciente@example.invalid",
  identification: null,
  billingName: "Carolina Courtis",
  billingIdType: "03",
  billingIdNumber: "186200123456",
  billingEmail: null,
};

/** Un Prisma de mentira que registra cada escritura. */
function baseFalsa({ original = ORIGINAL, existente = null, anuladas = 1, contacto = CONTACTO_CORREGIDO } = {}) {
  const tx = {
    user: { findUnique: vi.fn(async () => contacto) },
    invoice: {
      findUnique: vi.fn(async () => original),
      findFirst: vi.fn(async () => existente),
      updateMany: vi.fn(async () => ({ count: anuladas })),
      create: vi.fn(async ({ data }) => ({ id: "inv-nueva", feStatus: "PENDING", feClave: null, feNumber: null, feErrorMessage: null, ...data })),
    },
    deliveryJob: { updateMany: vi.fn(async () => ({ count: 1 })) },
    // Si esto se tocara, la reemisión estaría consumiendo un consecutivo real.
    invoiceSequence: { upsert: vi.fn(), update: vi.fn() },
  };
  const db = { $transaction: vi.fn(async (fn) => fn(tx)) };
  return { db, tx };
}

let fetchSpy;
beforeEach(() => {
  // Ninguna prueba de esta suite puede contactar a Hacienda.
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no se permite red en esta prueba"));
  return () => fetchSpy.mockRestore();
});

describe("reemitirFacturaRechazada", () => {
  it("anula la rechazada y crea la reemisión con el mismo pago y la misma cita", async () => {
    const { db, tx } = baseFalsa();

    const r = await reemitirFacturaRechazada(db, "inv-0203", { actorId: "admin-1", ahora: AHORA });

    expect(r.ok).toBe(true);
    expect(r.yaExistia).toBe(false);

    // Anulación condicionada a que siga como se la leyó.
    const anulacion = tx.invoice.updateMany.mock.calls[0][0];
    expect(anulacion.where).toEqual({ id: "inv-0203", status: { in: ["OPEN", "PAID"] }, feStatus: "REJECTED" });
    expect(anulacion.data.status).toBe("CANCELLED");
    expect(anulacion.data.notes).toContain("rechazada por Hacienda");
    expect(anulacion.data.notes).toContain(ORIGINAL.feClave);
    expect(anulacion.data.notes).toContain("sin nota de crédito");
    // El detalle de Hacienda no se pisa: es lo que dice qué pasó.
    expect(anulacion.data).not.toHaveProperty("feErrorMessage");
    expect(anulacion.data).not.toHaveProperty("feClave");
    expect(anulacion.data).not.toHaveProperty("feXml");

    const nueva = tx.invoice.create.mock.calls[0][0].data;
    expect(nueva).toMatchObject({
      status: "DRAFT",
      invoiceType: "CUSTOMER_INVOICE",
      appointmentId: "appt-1",
      contactId: "contact-1",
      amountPaid: 1000,
      balance: 0,
      total: 1000,
      originDocument: "REEMISION_DE:inv-0203",
      createdBy: "admin-1",
    });
    // El pago conserva su fecha real; el comprobante, la de hoy.
    expect(nueva.paymentDate).toEqual(ORIGINAL.paymentDate);
    expect(nueva.invoiceDate).toEqual(AHORA);
    expect(nueva.lines.create).toHaveLength(1);
    expect(nueva.lines.create[0]).toMatchObject({ cabysCode: "9310100002600", lineTotal: 1000, taxRate: 4 });
    // Sin identidad fiscal heredada: la clave rechazada no se reutiliza nunca.
    expect(nueva).not.toHaveProperty("feClave");
    expect(nueva).not.toHaveProperty("feNumber");
    expect(nueva).not.toHaveProperty("feXml");
  });

  it("no consume consecutivo ni contacta a Hacienda", async () => {
    const { db, tx } = baseFalsa();
    await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(tx.invoiceSequence.upsert).not.toHaveBeenCalled();
    expect(tx.invoiceSequence.update).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("el número provisional no se puede usar como consecutivo", async () => {
    // Si alguien intentara emitir la reemisión sin validarla, generateFeXml
    // falla acá en vez de inventar un consecutivo.
    const { db, tx } = baseFalsa();
    await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });
    const numero = tx.invoice.create.mock.calls[0][0].data.invoiceNumber;

    expect(numero).toBe("REEMISION-0203");
    expect(() => extractConsecutivo(numero)).toThrow(/no utilizable como consecutivo/);
  });

  it("cierra la tarea de envío de la rechazada sin borrarla", async () => {
    const { db, tx } = baseFalsa();
    await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(tx.deliveryJob.updateMany).toHaveBeenCalledWith({
      where: { dedupeKey: "FE_SUBMISSION:inv-0203", status: { not: "SUCCEEDED" } },
      data: expect.objectContaining({ status: "SUCCEEDED", lastErrorCode: "FE_REEMITIDA" }),
    });
  });

  it("es idempotente: un segundo intento devuelve la reemisión existente", async () => {
    const existente = { id: "inv-nueva", invoiceNumber: "REEMISION-0203", status: "DRAFT" };
    // Tras la primera reemisión, la original ya está CANCELLED.
    const { db, tx } = baseFalsa({ original: { ...ORIGINAL, status: "CANCELLED" }, existente });

    const r = await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(r).toMatchObject({ ok: true, yaExistia: true, reemision: existente });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("dos reemisiones simultáneas: la segunda aborta sin crear nada", async () => {
    // La anulación no encuentra la fila como la leyó: otra transacción ganó.
    const { db, tx } = baseFalsa({ anuladas: 0 });

    const r = await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(r).toMatchObject({ ok: false, status: 409, code: "CONFLICTO" });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it.each([
    ["PENDING", "puede aceptarse"],
    ["ACCEPTED", "nota de crédito"],
  ])("una factura %s no se reemite", async (feStatus, texto) => {
    const { db, tx } = baseFalsa({ original: { ...ORIGINAL, feStatus } });

    const r = await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(r).toMatchObject({ ok: false, status: 409, code: "NO_RECHAZADA" });
    expect(r.message).toContain(texto);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("una rechazada sin clave es inconsistente y no se toca", async () => {
    const { db, tx } = baseFalsa({ original: { ...ORIGINAL, feClave: null } });
    expect(await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA })).toMatchObject({ code: "NO_RECHAZADA" });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ invoiceType: "SUPPLIER_INVOICE" }, "TIPO_NO_REEMITIBLE"],
    [{ status: "DRAFT" }, "ESTADO_NO_REEMITIBLE"],
    [{ lines: [] }, "SIN_LINEAS"],
    [{ _count: { creditNotes: 1 } }, "TIENE_NOTA_CREDITO"],
  ])("rechaza %o con %s", async (cambio, code) => {
    const { db, tx } = baseFalsa({ original: { ...ORIGINAL, ...cambio } });
    expect(await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA })).toMatchObject({ ok: false, status: 409, code });
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("toma el receptor del perfil actual, no de la factura rechazada", async () => {
    // La 0204 se rechazó con -409 por el tipo 05. Si la reemisión copiara el
    // receptor de la rechazada, repetiría el mismo rechazo aunque el perfil ya
    // estuviera corregido.
    const { db, tx } = baseFalsa();
    await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "contact-1" } }));
    expect(tx.invoice.create.mock.calls[0][0].data).toMatchObject({
      contactName: "Carolina Courtis",
      contactIdType: "03",
      contactIdNumber: "186200123456",
    });
  });

  it("si el perfil sigue en tipo 05, no anula ni crea nada", async () => {
    // El orden correcto es corregir el dato y después reemitir. Rechazar acá
    // evita dejar un borrador con un receptor que nadie va a poder validar.
    const { db, tx } = baseFalsa({ contacto: { ...CONTACTO_CORREGIDO, billingIdType: "05", billingIdNumber: "95930281" } });

    const r = await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA });

    expect(r).toMatchObject({ ok: false, status: 409, code: "RECEPTOR_TIPO_NO_ADMITIDO" });
    expect(r.message).toMatch(/tipo 05.*-409/);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("si el perfil no tiene identificación fiscal, tampoco", async () => {
    const { db, tx } = baseFalsa({
      contacto: { ...CONTACTO_CORREGIDO, billingName: null, billingIdType: null, billingIdNumber: null, identification: null },
    });

    expect(await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA })).toMatchObject({ ok: false, status: 409, code: "RECEPTOR_SIN_IDENTIFICACION" });
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });

  it("una factura inexistente responde 404", async () => {
    const { db } = baseFalsa({ original: null });
    expect(await reemitirFacturaRechazada(db, "nada", { ahora: AHORA })).toMatchObject({ ok: false, status: 404 });
  });

  it("un choque en el número provisional se informa como conflicto, no como error", async () => {
    const { db, tx } = baseFalsa();
    tx.invoice.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    expect(await reemitirFacturaRechazada(db, "inv-0203", { ahora: AHORA })).toMatchObject({ ok: false, status: 409, code: "CONFLICTO" });
  });
});

describe("vínculo de reemisión", () => {
  it("reconoce la reemisión que ya existe en producción", () => {
    // La 0203 se creó con el script de reparación usando esta misma marca, así
    // que la operación nueva la reconoce como reemisión de la 0189.
    expect(esReemision({ originDocument: "REEMISION_DE:cmu7ooory0004y546luwtripo" })).toBe(true);
    expect(origenDeReemision("cmu7ooory0004y546luwtripo")).toBe("REEMISION_DE:cmu7ooory0004y546luwtripo");
  });

  it("no confunde el origen de un cobro con una reemisión", () => {
    expect(esReemision({ originDocument: "ONVO_TX:tx-1" })).toBe(false);
    expect(esReemision({ originDocument: "PAGO_MANUAL:tx-2" })).toBe(false);
    expect(esReemision({})).toBe(false);
    expect(esReemision(null)).toBe(false);
  });
});
