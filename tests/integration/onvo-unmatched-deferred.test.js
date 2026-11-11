import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ONVO avisa cada cobro dos veces: checkout-session.succeeded (con enlace, el que
// acredita) y payment-intent.succeeded (sin enlace). Si el segundo llega
// primero, ya no se alerta en el acto: QStash verifica a los ~5 minutos y solo
// avisa si el cobro sigue sin acreditar. Estas pruebas recorren el webhook y la
// verificación diferida contra una base en memoria, en todos los órdenes.

const mocks = vi.hoisted(() => ({
  send: vi.fn(), after: vi.fn(), programar: vi.fn(),
}));

// ── Base en memoria ─────────────────────────────────────────────────────────
const state = { txs: [], unmatched: [], seq: 0 };

function coincide(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] == null;
    if (value instanceof Date) return row[key] instanceof Date && row[key].getTime() === value.getTime();
    if (value && typeof value === "object" && Array.isArray(value.in)) return value.in.includes(row[key]);
    if (key === "webhookPayload") return row.webhookPayload?.data?.paymentIntentId === value.equals;
    return row[key] === value;
  });
}

const db = {
  paymentTransaction: {
    findFirst: vi.fn(async ({ where }) => state.txs.find((t) => coincide(t, where)) ?? null),
    findMany: vi.fn(async ({ where }) => state.txs.filter((t) => coincide(t, where))),
    update: vi.fn(async ({ where, data }) => {
      const row = state.txs.find((t) => t.id === where.id);
      Object.assign(row, data);
      return { ...row };
    }),
  },
  unmatchedPayment: {
    findUnique: vi.fn(async ({ where }) => state.unmatched.find((u) => coincide(u, where)) ?? null),
    create: vi.fn(async ({ data }) => {
      if (state.unmatched.some((u) => u.onvoEventId === data.onvoEventId)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const row = { id: `unm_${++state.seq}`, resolvedAt: null, resolvedTxId: null, resolution: null, alertedAt: null, ...data };
      state.unmatched.push(row);
      return { ...row };
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = state.unmatched.find((u) => u.id === where.id);
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      const rows = state.unmatched.filter((u) => coincide(u, where));
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    }),
  },
  appointment: { update: vi.fn(async () => ({})) },
  $transaction: vi.fn(async (fn) => fn(db)),
};

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: mocks.send } } }));
vi.mock("next/server", async (original) => ({ ...await original(), after: mocks.after }));
vi.mock("@/lib/qstash", () => ({ programarVerificacionDePago: mocks.programar }));
vi.mock("@/lib/qstash-webhook", () => ({ withQstashSignature: (handler) => handler }));
vi.mock("@/lib/payment-deliveries", () => ({ processPaymentDeliveries: vi.fn(async () => ({})) }));
vi.mock("@/lib/insurance-mail", () => ({ sendInsuranceProSignAlert: vi.fn(), sendPaligFormularioListo: vi.fn() }));
vi.mock("@/lib/analytics/reportDepositConversion", () => ({ reportDepositConversion: vi.fn(async () => false) }));
vi.mock("@/lib/analytics/meta-events", () => ({ sendPurchaseMeta: vi.fn(async () => false) }));
vi.mock("@/lib/exchange-rate", () => ({ obtenerTipoCambio: vi.fn(async () => ({ rate: 510 })) }));
vi.mock("@/lib/onvo/client", () => ({ buildPaymentLinkUrl: (id) => "https://payments.example.invalid/" + id }));
vi.mock("@/lib/onvo/payment-invoice", () => ({ createPaymentInvoice: vi.fn(async () => ({ invoiceId: "inv_1" })) }));
vi.mock("@/lib/delivery-jobs", () => ({ enqueueDelivery: vi.fn() }));
vi.mock("@/lib/price-ladder-server", () => ({ ocuparCupoEnTransaccion: vi.fn(async () => ({ cambiaPrecio: false })) }));
vi.mock("@/lib/revalidar-precios", () => ({ revalidarPreciosPublicos: vi.fn() }));
vi.mock("@/lib/commission-plan", () => ({ estimateOnvoFee: () => ({ totalCents: 0, fixedUsd: 0, usdCrcRate: 510 }) }));

const SECRET = "test-secret-local-only";
const EMAIL = "patient@example.invalid";
const INTENT = "pi_test_1";

const checkout = (overrides = {}) => ({
  type: "checkout-session.succeeded",
  data: {
    id: "cs_test_1", paymentLinkId: "link_1", paymentIntentId: INTENT, paymentStatus: "paid",
    amountTotal: 1500000, currency: "CRC", customerEmail: EMAIL, ...overrides,
  },
});
const intent = () => ({
  type: "payment-intent.succeeded",
  data: { id: INTENT, amount: 1500000, currency: "CRC", status: "succeeded", description: "Checkout Session Intent", metadata: null },
});

function cobroPendiente() {
  return {
    id: "tx_1", appointmentId: "apt_1", patientId: "pat_1", professionalId: "pro_1",
    type: "BALANCE_50", amount: 15000, currency: "CRC", status: "LINK_SENT",
    onvoPaymentLinkId: "link_1", onvoEventId: null, webhookPayload: null,
    patient: { name: "Persona de prueba", email: EMAIL, hasInsurance: false },
    professional: { academicDegree: "lic", user: { name: "Profesional de prueba" } },
    appointment: { id: "apt_1", paymentStatus: "PARTIALLY_PAID", pricePaid: 30000, service: { id: "svc_1", tax: { rate: 4 } } },
  };
}

async function webhook(body) {
  const { POST } = await import("../../src/app/api/payment/webhook/route.js");
  return POST(new Request("https://site.example.invalid/api/payment/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-secret": SECRET },
    body: JSON.stringify(body),
  }));
}

async function verificacion(unmatchedId) {
  const { POST } = await import("../../src/app/api/payment/unmatched-check/route.js");
  return POST(new Request("https://site.example.invalid/api/payment/unmatched-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unmatchedId }),
  }));
}

/** Alertas al admin (las únicas que usan `resend` directo en este recorrido). */
const alertas = () => mocks.send.mock.calls.map(([mail]) => mail).filter((mail) => mail.to === "admin@example.invalid");
const pendiente = () => state.unmatched.find((u) => u.onvoEventId === `payment-intent.succeeded:${INTENT}`);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.txs = [cobroPendiente()];
  state.unmatched = [];
  state.seq = 0;
  vi.stubEnv("ONVO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("RESEND_API_KEY", "test-only-mail-key");
  vi.stubEnv("ADMIN_ALERT_EMAIL", "admin@example.invalid");
  vi.stubEnv("EMAIL_FROM", "sender@example.invalid");
  vi.stubEnv("ONVO_AMOUNT_DIVISOR", "100");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.send.mockResolvedValue({ error: null });
  mocks.programar.mockResolvedValue({ programado: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("payment-intent primero y checkout después", () => {
  it("no alerta: el checkout acredita, cierra el pendiente y la verificación no tiene nada que hacer", async () => {
    expect((await webhook(intent())).status).toBe(200);
    expect(mocks.programar).toHaveBeenCalledTimes(1);
    expect(mocks.programar).toHaveBeenCalledWith(pendiente().id);
    expect(alertas()).toHaveLength(0);

    expect((await webhook(checkout())).status).toBe(200);
    expect(state.txs[0].status).toBe("APPROVED");
    expect(pendiente()).toMatchObject({ resolvedTxId: "tx_1", resolution: "CHECKOUT_POSTERIOR", alertedAt: null });

    const res = await verificacion(pendiente().id);
    expect(await res.json()).toMatchObject({ ok: true, result: "resolved" });
    expect(alertas()).toHaveLength(0);
  });

  it("si el pendiente quedó abierto pero el cobro está acreditado, la verificación lo cierra en silencio", async () => {
    await webhook(intent());
    // El checkout acreditó por otra vía y no cerró el pendiente.
    Object.assign(state.txs[0], { status: "APPROVED", webhookPayload: checkout() });

    const res = await verificacion(pendiente().id);
    expect(await res.json()).toMatchObject({ result: "closed" });
    expect(pendiente()).toMatchObject({ resolvedTxId: "tx_1", resolution: "VERIFICACION_DIFERIDA", alertedAt: null });
    expect(alertas()).toHaveLength(0);
  });
});

describe("checkout primero y payment-intent después", () => {
  it("no alerta ni programa nada: el segundo aviso es el mismo cobro", async () => {
    expect((await webhook(checkout())).status).toBe(200);
    expect(state.txs[0].status).toBe("APPROVED");

    expect((await webhook(intent())).status).toBe(200);
    expect(state.unmatched).toHaveLength(0);
    expect(mocks.programar).not.toHaveBeenCalled();
    expect(alertas()).toHaveLength(0);
  });
});

describe("payment-intent sin checkout", () => {
  it("alerta una sola vez tras la espera, con el monto en colones y los ids del cobro", async () => {
    await webhook(intent());
    expect(alertas()).toHaveLength(0);

    const res = await verificacion(pendiente().id);
    expect(await res.json()).toMatchObject({ ok: true, result: "alerted" });
    expect(alertas()).toHaveLength(1);
    const { html, subject } = alertas()[0];
    expect(subject).toContain("NO_TRANSACTION");
    expect(html).toContain("₡15");
    expect(html).not.toContain("1500000");
    expect(html).toContain(INTENT);
    expect(html).not.toContain(EMAIL);
    expect(pendiente().alertedAt).toBeInstanceOf(Date);
    expect(pendiente().resolvedAt).toBeNull();

    // Reintento o entrega duplicada de QStash: no repite la alerta.
    const otra = await verificacion(pendiente().id);
    expect(await otra.json()).toMatchObject({ result: "already_alerted" });
    expect(alertas()).toHaveLength(1);
  });

  it("si el correo falla, suelta el candado y pide a QStash que reintente; el reintento avisa una vez", async () => {
    await webhook(intent());
    mocks.send.mockResolvedValueOnce({ error: { message: "proveedor caído" } });

    const fallida = await verificacion(pendiente().id);
    expect(fallida.status).toBe(500);
    expect(pendiente().alertedAt).toBeNull();

    const reintento = await verificacion(pendiente().id);
    expect(await reintento.json()).toMatchObject({ result: "alerted" });
    expect(alertas().length).toBe(2); // la fallida y la buena
    expect(pendiente().alertedAt).toBeInstanceOf(Date);
  });

  it("si no se pudo programar la verificación, alerta en el acto", async () => {
    mocks.programar.mockResolvedValue({ programado: false, motivo: "ERROR" });
    await webhook(intent());
    expect(alertas()).toHaveLength(1);
    expect(pendiente().alertedAt).toBeInstanceOf(Date);

    // Y la verificación, si igual llegara, no repite.
    await verificacion(pendiente().id);
    expect(alertas()).toHaveLength(1);
  });
});

describe("eventos duplicados", () => {
  it("un payment-intent repetido no crea otro pendiente ni otra verificación", async () => {
    await webhook(intent());
    await webhook(intent());
    expect(state.unmatched).toHaveLength(1);
    expect(mocks.programar).toHaveBeenCalledTimes(1);
    expect(alertas()).toHaveLength(0);
  });

  it("un checkout repetido no acredita dos veces", async () => {
    await webhook(checkout());
    await webhook(checkout());
    expect(db.paymentTransaction.update).toHaveBeenCalledTimes(1);
    expect(alertas()).toHaveLength(0);
  });

  it("un pendiente inexistente no rompe ni alerta", async () => {
    const res = await verificacion("no_existe");
    expect(await res.json()).toMatchObject({ result: "not_found" });
    expect(alertas()).toHaveLength(0);
  });
});

describe("checkout con enlace que no coincide", () => {
  it("sigue alertando en el acto, sin verificación diferida", async () => {
    await webhook(checkout({ amountTotal: 9900000 }));
    expect(mocks.programar).not.toHaveBeenCalled();
    expect(alertas()).toHaveLength(1);
    const { html } = alertas()[0];
    expect(html).toContain("AMOUNT_MISMATCH");
    expect(html).toContain("₡99");
    expect(html).toContain("cs_test_1");
    expect(html).toContain(INTENT);
  });
});
