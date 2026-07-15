// tests/unit/fe-submit.test.js
// Tests para el guard de facturación electrónica simulada (FIS-01).
//
// Cubre dos escenarios críticos de submitInvoiceToFe():
//   (a) Producción SIN FE_API_URL  → factura PENDING, alerta al admin, NUNCA correo al paciente.
//   (b) Desarrollo (mock)          → ACCEPTED marcado "SIMULADO" y sin correo al paciente.
//
// Prisma y Resend están mockeados con vi.mock. El módulo se reimporta en cada test
// con vi.resetModules() porque FE_API_URL se lee al cargar el módulo.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock de Prisma ────────────────────────────────────────────────────────────
const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({
  prisma: { invoice: { findUnique, update } },
}));

// ── Mock de Resend ────────────────────────────────────────────────────────────
// submit.js hace: import { Resend } from "resend"; const resend = new Resend(...).
const sendMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("resend", () => ({
  Resend: class {
    constructor() {
      this.emails = { send: sendMock };
    }
  },
}));

// ── Mock de los helpers de XML/config usados en modo mock ─────────────────────
vi.mock("@/lib/fe/xml.js", () => ({
  buildFeNumber: () => "00100001010000000001",
  buildFeClave: () => "50601010101010101010101010101010101010101010101010",
  extractConsecutivo: () => "1",
}));
vi.mock("@/lib/fe/config.js", () => ({
  TIPO_DOC_MAP: { CUSTOMER_INVOICE: "01" },
}));

const PATIENT_EMAIL = "paciente@ejemplo.cr";

function fakeInvoice(overrides = {}) {
  return {
    id: "inv_1",
    status: "OPEN",
    feStatus: null,
    invoiceNumber: "0001",
    invoiceType: "CUSTOMER_INVOICE",
    invoiceDate: new Date("2026-07-15"),
    feNumber: null,
    feClave: null,
    total: 45500,
    currency: "CRC",
    contact: { email: PATIENT_EMAIL, name: "Paciente", identification: "0" },
    lines: [],
    ...overrides,
  };
}

/** Carga fresca del módulo con el entorno ya preparado. */
async function loadSubmit() {
  vi.resetModules();
  return import("@/lib/fe/submit.js");
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({});
  sendMock.mockReset().mockResolvedValue({ error: null });
  // Base limpia: sin integración real, con Resend "configurado".
  delete process.env.FE_API_URL;
  delete process.env.VERCEL_ENV;
  delete process.env.ADMIN_ALERT_EMAIL;
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Salud Mental <no-reply@ejemplo.cr>";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("submitInvoiceToFe() — guard de FE simulada (FIS-01)", () => {
  it("(a) en producción sin FE_API_URL: deja PENDING, alerta al admin y NO envía correo al paciente", async () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_ALERT_EMAIL = "admin@ejemplo.cr";
    findUnique.mockResolvedValue(fakeInvoice());

    const { submitInvoiceToFe } = await loadSubmit();
    const result = await submitInvoiceToFe("inv_1");

    expect(result.feStatus).toBe("PENDING");
    expect(result.feNumber).toBeNull();
    expect(result.feClave).toBeNull();
    expect(result.feErrorMessage).toMatch(/FE_API_URL/);

    // La factura se persiste como PENDING sin número simulado.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1" },
        data: expect.objectContaining({ feStatus: "PENDING", feNumber: null }),
      })
    );

    // Se envía exactamente una alerta, y va al admin, NUNCA al paciente.
    expect(sendMock).toHaveBeenCalledTimes(1);
    const alert = sendMock.mock.calls[0][0];
    expect(alert.to).toBe("admin@ejemplo.cr");
    expect(alert.to).not.toBe(PATIENT_EMAIL);
    // Ninguna llamada de correo apunta al paciente.
    for (const [msg] of sendMock.mock.calls) {
      expect(msg.to).not.toBe(PATIENT_EMAIL);
    }
  });

  it("(b) en desarrollo (mock): marca ACCEPTED como SIMULADO y NO envía correo al paciente", async () => {
    process.env.NODE_ENV = "development";
    findUnique.mockResolvedValue(fakeInvoice());

    const { submitInvoiceToFe } = await loadSubmit();
    const result = await submitInvoiceToFe("inv_1");

    expect(result.feStatus).toBe("ACCEPTED");
    expect(result.feNumber).toBeTruthy();
    expect(result.feErrorMessage).toBe("SIMULADO — sin validez tributaria");

    // Persistida como simulada.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feStatus: "ACCEPTED",
          feErrorMessage: "SIMULADO — sin validez tributaria",
        }),
      })
    );

    // En modo mock NUNCA se envía correo (ni al paciente ni alerta al admin).
    expect(sendMock).not.toHaveBeenCalled();
  });
});
