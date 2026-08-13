// tests/unit/webhook-verify.test.js
// Tests para la verificación de origen del webhook de ONVO Pay.
//
// ONVO no firma el cuerpo: manda el secreto en el header `X-Webhook-Secret` y el
// receptor lo compara contra el valor del dashboard.
// Ver https://docs.onvopay.com/en/webhooks
import { describe, it, expect } from "vitest";
import { verifyOnvoWebhookSecret } from "../../src/lib/onvo/webhook.js";

const SECRET = "webhook_secret_abc123";

describe("verifyOnvoWebhookSecret()", () => {
  it("retorna true cuando el header coincide con el secreto", () => {
    expect(verifyOnvoWebhookSecret(SECRET, SECRET)).toBe(true);
  });

  it("ignora espacios alrededor del valor recibido", () => {
    expect(verifyOnvoWebhookSecret(`  ${SECRET}\n`, SECRET)).toBe(true);
  });

  it("retorna false con un secreto distinto de igual longitud", () => {
    const otro = "webhook_secret_xyz789";
    expect(otro).toHaveLength(SECRET.length);
    expect(verifyOnvoWebhookSecret(otro, SECRET)).toBe(false);
  });

  it("retorna false si el header es un prefijo del secreto", () => {
    expect(verifyOnvoWebhookSecret(SECRET.slice(0, -1), SECRET)).toBe(false);
  });

  it("retorna false si faltan parámetros", () => {
    expect(verifyOnvoWebhookSecret("", SECRET)).toBe(false);
    expect(verifyOnvoWebhookSecret(SECRET, "")).toBe(false);
    expect(verifyOnvoWebhookSecret(undefined, SECRET)).toBe(false);
    expect(verifyOnvoWebhookSecret(SECRET, undefined)).toBe(false);
  });
});
