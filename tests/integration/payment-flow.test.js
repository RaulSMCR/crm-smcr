// tests/integration/payment-flow.test.js
//
// Tests de integración para el flujo webhook de ONVO Pay → DB.
// Usa mocks de Prisma para no necesitar DB real.
//
import { describe, it, expect, vi } from "vitest";
import { verifyOnvoWebhookSecret } from "../../src/lib/onvo/webhook.js";
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

const WEBHOOK_SECRET = "webhook_secret_test_onvo";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("verifyOnvoWebhookSecret", () => {
  it("acepta el secreto compartido que ONVO manda en X-Webhook-Secret", () => {
    expect(verifyOnvoWebhookSecret(WEBHOOK_SECRET, WEBHOOK_SECRET)).toBe(true);
  });

  it("rechaza un secreto incorrecto", () => {
    expect(verifyOnvoWebhookSecret("webhook_secret_otro_val", WEBHOOK_SECRET)).toBe(false);
  });

  it("retorna false si faltan parametros", () => {
    expect(verifyOnvoWebhookSecret("", WEBHOOK_SECRET)).toBe(false);
    expect(verifyOnvoWebhookSecret(WEBHOOK_SECRET, "")).toBe(false);
  });
});

describe("buildPaymentLinkUrl", () => {
  it("construye la URL desde el ID de enlace ONVO", () => {
    const url = buildPaymentLinkUrl("test_amhNGWevAahXl42GYZ-z3LOKCDU");
    expect(url).toBe("https://buy.onvopay.com/test_amhNGWevAahXl42GYZ-z3LOKCDU");
  });

  it("lanza error si no se provee linkId", () => {
    expect(() => buildPaymentLinkUrl("")).toThrow();
    expect(() => buildPaymentLinkUrl(null)).toThrow();
  });
});
