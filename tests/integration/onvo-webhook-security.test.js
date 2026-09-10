import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    paymentTransaction: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    unmatchedPayment: { findUnique: vi.fn(), upsert: vi.fn() },
    appointment: { update: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn() },
    invoiceSequence: { upsert: vi.fn() },
    insuranceClaim: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  send: vi.fn(), after: vi.fn(), submitInvoice: vi.fn(),
  insuranceAlert: vi.fn(), depositConversion: vi.fn(), purchaseMeta: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: mocks.send } } }));
vi.mock("next/server", async (original) => ({ ...await original(), after: mocks.after }));
vi.mock("@/lib/fe/submit", () => ({ submitInvoiceToFe: mocks.submitInvoice }));
vi.mock("@/lib/insurance-mail", () => ({ sendInsuranceProSignAlert: mocks.insuranceAlert }));
vi.mock("@/lib/analytics/reportDepositConversion", () => ({ reportDepositConversion: mocks.depositConversion }));
vi.mock("@/lib/analytics/meta-events", () => ({ sendPurchaseMeta: mocks.purchaseMeta }));
vi.mock("@/lib/exchange-rate", () => ({ obtenerTipoCambio: vi.fn(async () => ({ rate: 510 })) }));
vi.mock("@/lib/payment-requests", () => ({ paymentTypeLabel: () => "pago" }));
vi.mock("@/lib/onvo/client", () => ({ buildPaymentLinkUrl: (id) => "https://payments.example.invalid/" + id }));

const SECRET = "test-secret-local-only";
const EMAIL = "patient@example.invalid";
const MARKER = "PRIVATE_CONTENT_TEST";
const event = () => ({
  type: "checkout-session.succeeded",
  data: {
    id: "checkout_test", paymentLinkId: "test_link", paymentStatus: "paid",
    amountTotal: 4000000, currency: "CRC", customerEmail: EMAIL,
    customer: { name: MARKER, email: EMAIL },
    metadata: { note: MARKER }, updatedAt: "2026-09-10T12:00:00Z",
  },
});
function request(body = event(), secret = SECRET) {
  return new Request("https://site.example.invalid/api/payment/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": secret },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function transaction() {
  return {
    id: "tx_test", appointmentId: "apt_test", patientId: "patient_test",
    professionalId: "pro_test", type: "FULL", amount: 40000, currency: "CRC",
    onvoPaymentLinkId: "test_link",
    patient: { name: "Persona de prueba", email: EMAIL, hasInsurance: false },
    professional: { academicDegree: "lic", user: { name: "Profesional de prueba" } },
    appointment: {
      id: "apt_test", date: new Date("2026-09-12T18:00:00Z"), modality: "ONLINE",
      pricePaid: 40000,
      service: { id: "svc_test", title: "Servicio de prueba", cabysCode: "test-code", taxId: "tax_test", tax: { rate: 4 } },
    },
  };
}
let logs;
async function handler() {
  return (await import("../../src/app/api/payment/webhook/route.js")).POST;
}
function expectNoEffects() {
  for (const model of Object.values(mocks.db)) {
    if (typeof model === "function") expect(model).not.toHaveBeenCalled();
    else for (const method of Object.values(model)) expect(method).not.toHaveBeenCalled();
  }
  for (const fn of [mocks.send, mocks.after, mocks.submitInvoice, mocks.insuranceAlert, mocks.depositConversion, mocks.purchaseMeta]) {
    expect(fn).not.toHaveBeenCalled();
  }
}
function expectPrivateDataAbsent(extra = "") {
  const output = JSON.stringify(logs.map((spy) => spy.mock.calls)) + extra;
  for (const forbidden of [EMAIL, MARKER, SECRET, "ONVO RAW"]) expect(output).not.toContain(forbidden);
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("ONVO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("RESEND_API_KEY", "test-only-mail-key");
  vi.stubEnv("ADMIN_ALERT_EMAIL", "admin@example.invalid");
  vi.stubEnv("EMAIL_FROM", "sender@example.invalid");
  vi.stubEnv("ONVO_AMOUNT_DIVISOR", "100");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in this test"); }));
  logs = ["info", "warn", "error", "log"].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
  mocks.db.paymentTransaction.findFirst.mockResolvedValue(null);
  mocks.db.unmatchedPayment.findUnique.mockResolvedValue(null);
  mocks.db.paymentTransaction.findMany.mockResolvedValue([]);
  mocks.db.unmatchedPayment.upsert.mockResolvedValue({ id: "unmatched_test" });
  mocks.db.paymentTransaction.update.mockImplementation(async ({ data }) => ({ id: "tx_test", ...data }));
  mocks.db.appointment.update.mockResolvedValue({ id: "apt_test" });
  mocks.db.invoice.create.mockResolvedValue({ id: "invoice_test" });
  mocks.db.invoice.update.mockResolvedValue({ id: "invoice_test" });
  mocks.db.invoiceSequence.upsert.mockResolvedValue({ currentNumber: 1, padding: 4, prefix: "" });
  mocks.db.$transaction.mockImplementation(async (fn) => fn(mocks.db));
  mocks.send.mockResolvedValue({ error: null });
  mocks.submitInvoice.mockResolvedValue(null);
  mocks.insuranceAlert.mockResolvedValue(null);
  mocks.depositConversion.mockResolvedValue(false);
  mocks.purchaseMeta.mockResolvedValue(false);
});
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Webhook ONVO: autenticación, privacidad y continuidad", () => {
  it.each(["", "incorrect-secret"])("rechaza un secreto inválido sin leer el cuerpo ni producir efectos: %s", async (secret) => {
    const POST = await handler();
    const req = { headers: new Headers({ "x-webhook-secret": secret }), json: vi.fn() };
    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(req.json).not.toHaveBeenCalled();
    expectNoEffects();
    expectPrivateDataAbsent(await response.text());
  });

  it("falla de forma segura si no se configuró el secreto", async () => {
    vi.stubEnv("ONVO_WEBHOOK_SECRET", "");
    const POST = await handler();
    const req = { headers: new Headers(), json: vi.fn() };
    expect((await POST(req)).status).toBe(503);
    expect(req.json).not.toHaveBeenCalled();
    expectNoEffects();
  });

  it.each(["not-json", "null", "[]", '{"data":[]}'])("rechaza un cuerpo inválido autenticado sin efectos: %s", async (body) => {
    const POST = await handler();
    expect((await POST(request(body))).status).toBe(400);
    expectNoEffects();
    expectPrivateDataAbsent();
  });

  it("conserva la conciliación autenticada sin difundir la identidad en logs o alertas", async () => {
    const POST = await handler();
    expect((await POST(request())).status).toBe(200);
    expect(mocks.db.unmatchedPayment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        onvoEventId: "checkout-session.succeeded:checkout_test",
        customerEmail: EMAIL, amount: 4000000, reason: "NO_TRANSACTION",
      }),
    }));
    expect(mocks.db.appointment.update).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const mail = mocks.send.mock.calls[0][0];
    expect(mail.to).toBe("admin@example.invalid");
    expect(mail.html).toContain("checkout-session.succeeded:checkout_test");
    expect(mail.html).toContain("test_link");
    expectPrivateDataAbsent(JSON.stringify(mail));
    expect(logs[1]).toHaveBeenCalledWith("[ONVO webhook]", expect.objectContaining({
      action: "UNMATCHED", eventId: "checkout-session.succeeded:checkout_test", reason: "NO_TRANSACTION",
    }));
  });

  it("escapa contenido de un evento autenticado antes de incorporarlo a la alerta", async () => {
    const POST = await handler();
    const body = event();
    body.data.paymentLinkId = '<img src=x onerror="test()">&';
    expect((await POST(request(body))).status).toBe(200);
    const html = mocks.send.mock.calls[0][0].html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;test()&quot;&gt;&amp;");
    expect(JSON.stringify(logs.map((spy) => spy.mock.calls))).not.toContain("onerror");
  });

  it("mantiene la acreditación, factura y confirmación de un pago válido", async () => {
    const POST = await handler();
    mocks.db.paymentTransaction.findMany.mockResolvedValue([transaction()]);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.db.paymentTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "APPROVED", onvoEventId: "checkout-session.succeeded:checkout_test" }),
    }));
    expect(mocks.db.appointment.update).toHaveBeenCalledWith({
      where: { id: "apt_test" }, data: { paymentStatus: "PAID" },
    });
    expect(mocks.db.invoice.create).toHaveBeenCalledTimes(1);
    expect(mocks.db.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAID", amountPaid: 40000, balance: 0 }),
    }));
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL }));
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.submitInvoice).toHaveBeenCalledWith("invoice_test");
    expectPrivateDataAbsent();
  });

  it.each([
    ["payment-intent.failed", "failed", "REJECTED", 1],
    ["checkout-session.created", "open", "LINK_SENT", 0],
  ])("conserva el tratamiento del evento %s", async (type, status, expectedStatus, mails) => {
    const POST = await handler();
    mocks.db.paymentTransaction.findMany.mockResolvedValue([transaction()]);
    const body = event(); body.type = type; body.data.paymentStatus = status;
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.db.paymentTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: expectedStatus }),
    }));
    expect(mocks.db.appointment.update).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledTimes(mails);
    expectPrivateDataAbsent();
  });

  it("mantiene el descarte de un evento ya procesado", async () => {
    const POST = await handler();
    mocks.db.paymentTransaction.findFirst.mockResolvedValue({ id: "tx_test" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.db.paymentTransaction.findMany).not.toHaveBeenCalled();
    expect(mocks.db.paymentTransaction.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expectPrivateDataAbsent();
  });

  it("devuelve un error genérico y conserva la referencia sin registrar el error de Prisma", async () => {
    const POST = await handler();
    mocks.db.paymentTransaction.findFirst.mockRejectedValue(Object.assign(
      new Error(MARKER + EMAIL), { code: "P2024", meta: { query: MARKER } },
    ));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
    expect(logs[2]).toHaveBeenCalledWith("[ONVO webhook]", {
      action: "PROCESSING_FAILED", eventId: "checkout-session.succeeded:checkout_test",
      onvoLinkId: "test_link", errorCode: "P2024",
    });
    expectPrivateDataAbsent();
  });

  it("no vuelca errores del proveedor de correo en las alertas de conciliación", async () => {
    const POST = await handler();
    mocks.send.mockRejectedValue(new Error(EMAIL + MARKER));
    expect((await POST(request())).status).toBe(200);
    expect(logs[2]).toHaveBeenCalledWith("[ONVO webhook]", expect.objectContaining({
      action: "UNMATCHED_ALERT_FAILED", eventId: "checkout-session.succeeded:checkout_test",
    }));
    expectPrivateDataAbsent();
  });
});
