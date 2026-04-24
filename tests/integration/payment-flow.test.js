// tests/integration/payment-flow.test.js
//
// Tests de integración para el flujo webhook de ONVO Pay → DB.
// Usa mocks de Prisma para no necesitar DB real.
//
import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import { verifyOnvoWebhook } from "../../src/lib/onvo/webhook.js";
import { buildPaymentLinkUrl } from "../../src/lib/onvo/client.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    paymentTransaction: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) =>
      fn({
        invoice: { create: vi.fn().mockResolvedValue({ id: "inv_1" }), update: vi.fn() },
        invoiceSequence: {
          upsert: vi.fn().mockResolvedValue({ currentNumber: 1, padding: 4, prefix: "" }),
        },
      })
    ),
  },
}));

vi.mock("../../src/lib/resend.js", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "mock-email-id" }, error: null }),
    },
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "test_onvo_webhook_secret";

function makeOnvoSignature(body) {
  return "v1=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("verifyOnvoWebhook", () => {
  const payload = JSON.stringify({
    id: "evt_test_001",
    type: "payment.completed",
    data: { payment_link_id: "live_testlink123", status: "approved", amount: 45500 },
  });

  it("verifica correctamente una firma ONVO válida", () => {
    const sig = makeOnvoSignature(payload);
    expect(verifyOnvoWebhook(payload, sig, WEBHOOK_SECRET)).toBe(true);
  });

  it("rechaza firma inválida", () => {
    expect(verifyOnvoWebhook(payload, "v1=invalidsig", WEBHOOK_SECRET)).toBe(false);
  });

  it("rechaza body alterado", () => {
    const sig = makeOnvoSignature(payload);
    expect(verifyOnvoWebhook(payload + " ", sig, WEBHOOK_SECRET)).toBe(false);
  });

  it("rechaza secreto incorrecto", () => {
    const sig = makeOnvoSignature(payload);
    expect(verifyOnvoWebhook(payload, sig, "wrong_secret")).toBe(false);
  });

  it("retorna false si faltan parámetros", () => {
    const sig = makeOnvoSignature(payload);
    expect(verifyOnvoWebhook("", sig, WEBHOOK_SECRET)).toBe(false);
    expect(verifyOnvoWebhook(payload, "", WEBHOOK_SECRET)).toBe(false);
    expect(verifyOnvoWebhook(payload, sig, "")).toBe(false);
  });
});

describe("buildPaymentLinkUrl", () => {
  it("construye la URL desde el ID de enlace ONVO", () => {
    const url = buildPaymentLinkUrl("live_P35LcuWqpsttLAhsJj0Q2urFSzs");
    expect(url).toBe("https://checkout.onvopay.com/pay/live_P35LcuWqpsttLAhsJj0Q2urFSzs");
  });

  it("lanza error si no se provee linkId", () => {
    expect(() => buildPaymentLinkUrl("")).toThrow();
    expect(() => buildPaymentLinkUrl(null)).toThrow();
  });
});
