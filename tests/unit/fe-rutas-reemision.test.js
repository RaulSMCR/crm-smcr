import { beforeEach, describe, expect, it, vi } from "vitest";

// Las rutas que tocan una factura rechazada. Todo con dobles: ninguna prueba
// contacta a Hacienda ni consume un consecutivo real.

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  emisor: vi.fn(),
  tx: null,
  reemitir: vi.fn(),
}));

vi.mock("@/lib/api-guards", () => ({ requireAdmin: mocks.admin, requireEmisorResponsable: mocks.emisor }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn(async (fn) => fn(mocks.tx)) } }));

const sesion = { session: { sub: "admin-1", role: "ADMIN" } };
const params = (id) => ({ params: Promise.resolve({ id }) });
const peticion = (body = {}) => new Request("http://local.invalid", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue(sesion);
  mocks.emisor.mockResolvedValue(sesion);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/invoices/:id/credit-note — no rectifica lo que nunca valió", () => {
  const linea = { productId: null, serviceId: "s", productName: "p", description: "d", cabysCode: "c", accountCode: null, quantity: 1, unitOfMeasure: "Sp", unitPrice: 100, discountPercent: 0, discountType: null, taxId: "t", taxRate: 4, taxAmount: 4, lineSubtotal: 100, lineTotal: 104, sortOrder: 0 };

  function conFactura(origin) {
    mocks.tx = {
      invoice: {
        findUnique: vi.fn(async () => origin),
        create: vi.fn(async ({ data }) => ({ id: "nc-1", ...data, total: -104 })),
      },
      invoiceSequence: { upsert: vi.fn(async () => ({ currentNumber: 4, padding: 4, prefix: "" })) },
    };
  }

  const llamar = async () => {
    const { POST } = await import("@/app/api/invoices/[id]/credit-note/route.js");
    return POST(peticion({ notes: "x" }), params("inv-1"));
  };

  it("sobre una factura de cliente rechazada responde 409 y no emite nada", async () => {
    conFactura({ id: "inv-1", invoiceType: "CUSTOMER_INVOICE", status: "PAID", feStatus: "REJECTED", lines: [linea] });

    const res = await llamar();

    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/nunca tuvo validez.*reemitirla/);
    expect(mocks.tx.invoiceSequence.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.invoice.create).not.toHaveBeenCalled();
  });

  it("sobre una factura de cliente que nunca se aceptó también responde 409", async () => {
    conFactura({ id: "inv-1", invoiceType: "CUSTOMER_INVOICE", status: "PAID", feStatus: "PENDING", lines: [linea] });
    expect((await llamar()).status).toBe(409);
    expect(mocks.tx.invoiceSequence.upsert).not.toHaveBeenCalled();
  });

  it("sobre una factura de cliente aceptada sigue funcionando", async () => {
    conFactura({ id: "inv-1", invoiceType: "CUSTOMER_INVOICE", status: "PAID", feStatus: "ACCEPTED", invoiceNumber: "0150", lines: [linea] });
    const res = await llamar();
    expect(res.status).not.toBe(409);
    expect(mocks.tx.invoice.create).toHaveBeenCalled();
  });

  it("las facturas de proveedor no quedan bloqueadas por la regla nueva", async () => {
    // Su feStatus nunca llega a ACCEPTED: aplicarles la regla las dejaría sin
    // nota de crédito para siempre.
    conFactura({ id: "inv-1", invoiceType: "SUPPLIER_INVOICE", status: "PAID", feStatus: "PENDING", invoiceNumber: "FACT/2026/0007", lines: [linea] });
    const res = await llamar();
    expect(res.status).not.toBe(409);
    expect(mocks.tx.invoice.create).toHaveBeenCalled();
  });
});

describe("POST /api/invoices/:id/validate — la fecha del pago no se mueve", () => {
  function conBorrador(borrador) {
    mocks.tx = {
      invoice: {
        findUnique: vi.fn(async () => borrador),
        update: vi.fn(async ({ data }) => ({ id: borrador.id, ...borrador, ...data })),
      },
      invoiceSequence: { upsert: vi.fn(async () => ({ currentNumber: 204, padding: 4, prefix: "", year: 2026 })) },
    };
  }

  const llamar = async () => {
    const { POST } = await import("@/app/api/invoices/[id]/validate/route.js");
    return POST(peticion(), params("inv-nueva"));
  };

  const pagoReal = new Date("2026-09-18T23:46:52Z");
  const borradorViejo = new Date("2026-10-10T12:00:00Z");

  it("una reemisión conserva la fecha del pago y toma la fecha de hoy como emisión", async () => {
    conBorrador({
      id: "inv-nueva", invoiceType: "CUSTOMER_INVOICE", status: "DRAFT", lines: [{}],
      total: 1000, amountPaid: 1000, paymentDate: pagoReal, invoiceDate: borradorViejo,
      originDocument: "REEMISION_DE:inv-0203",
    });

    expect((await llamar()).status).toBe(200);
    const { data } = mocks.tx.invoice.update.mock.calls[0][0];

    expect(data.invoiceNumber).toBe("0204");
    expect(data.status).toBe("PAID");
    expect(data.paymentDate).toEqual(pagoReal);
    // La clave codifica la fecha de emisión: un borrador que esperó días no
    // puede salir con la fecha en que se creó.
    expect(data.invoiceDate.getTime()).toBeGreaterThan(borradorViejo.getTime());
  });

  it("un borrador común conserva la fecha de pago que se le cargó", async () => {
    // Antes se pisaba con la hora de la validación.
    conBorrador({
      id: "inv-nueva", invoiceType: "CUSTOMER_INVOICE", status: "DRAFT", lines: [{}],
      total: 500, amountPaid: 500, paymentDate: pagoReal, invoiceDate: borradorViejo, originDocument: null,
    });

    await llamar();
    const { data } = mocks.tx.invoice.update.mock.calls[0][0];
    expect(data.paymentDate).toEqual(pagoReal);
    // Y su fecha de factura la elige quien la cargó: no se toca.
    expect(data).not.toHaveProperty("invoiceDate");
  });

  it("un borrador pagado sin fecha de pago toma la de la validación", async () => {
    conBorrador({
      id: "inv-nueva", invoiceType: "CUSTOMER_INVOICE", status: "DRAFT", lines: [{}],
      total: 500, amountPaid: 500, paymentDate: null, invoiceDate: borradorViejo, originDocument: null,
    });

    await llamar();
    expect(mocks.tx.invoice.update.mock.calls[0][0].data.paymentDate).toBeInstanceOf(Date);
  });
});

describe("POST /api/invoices/:id/reissue", () => {
  beforeEach(() => {
    vi.doMock("@/lib/fe/reemision", () => ({ reemitirFacturaRechazada: mocks.reemitir }));
  });

  const llamar = async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/invoices/[id]/reissue/route.js");
    return POST(peticion(), params("inv-0203"));
  };

  const reemision = {
    id: "inv-nueva", invoiceNumber: "REEMISION-0203", invoiceType: "CUSTOMER_INVOICE", status: "DRAFT",
    invoiceDate: new Date(), contactName: "P", total: 1000, amountPaid: 1000, balance: 0,
    feStatus: "PENDING", feNumber: null, feClave: null, feErrorMessage: null,
    appointmentId: "appt-1", originDocument: "REEMISION_DE:inv-0203",
  };

  it("exige a la persona responsable de la emisión, no solo el rol ADMIN", async () => {
    mocks.emisor.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    const res = await llamar();
    expect(res.status).toBe(403);
    expect(mocks.reemitir).not.toHaveBeenCalled();
  });

  it("201 con la reemisión en forma de fila del listado", async () => {
    mocks.reemitir.mockResolvedValue({ ok: true, yaExistia: false, original: { id: "inv-0203", status: "CANCELLED" }, reemision });
    const res = await llamar();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.original).toEqual({ id: "inv-0203", status: "CANCELLED" });
    expect(body.reemision).toMatchObject({ id: "inv-nueva", status: "DRAFT", amountPaid: 1000, appointmentId: "appt-1" });
    expect(mocks.reemitir).toHaveBeenCalledWith(expect.anything(), "inv-0203", { actorId: "admin-1" });
  });

  it("200 cuando ya existía, para que el doble clic no parezca un error", async () => {
    mocks.reemitir.mockResolvedValue({ ok: true, yaExistia: true, original: { id: "inv-0203", status: "CANCELLED" }, reemision });
    expect((await llamar()).status).toBe(200);
  });

  it("propaga el 409 de la regla con su mensaje", async () => {
    mocks.reemitir.mockResolvedValue({ ok: false, status: 409, code: "NO_RECHAZADA", message: "Solo se reemite una factura que Hacienda rechazó." });
    const res = await llamar();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "Solo se reemite una factura que Hacienda rechazó.", code: "NO_RECHAZADA" });
  });

  it("un error inesperado responde 500 sin volcar el detalle", async () => {
    mocks.reemitir.mockRejectedValue(new Error("detalle-privado"));
    const res = await llamar();
    expect(res.status).toBe(500);
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("detalle-privado");
  });
});
