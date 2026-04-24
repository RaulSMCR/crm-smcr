// tests/unit/webhook-verify.test.js
// Tests para la verificación de firma HMAC-SHA256 del webhook de ONVO Pay.
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyOnvoWebhook } from "../../src/lib/onvo/webhook.js";

const SECRET = "test_webhook_secret";

function makeSignature(body) {
  return "v1=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyOnvoWebhook()", () => {
  const body = JSON.stringify({ id: "evt_123", type: "payment.completed", data: { status: "approved" } });
  const validSig = makeSignature(body);

  it("retorna true con firma válida", () => {
    expect(verifyOnvoWebhook(body, validSig, SECRET)).toBe(true);
  });

  it("retorna true con prefijo v1= en la firma", () => {
    expect(verifyOnvoWebhook(body, validSig, SECRET)).toBe(true);
  });

  it("retorna false si el body fue alterado", () => {
    const alteredBody = body + " ";
    expect(verifyOnvoWebhook(alteredBody, validSig, SECRET)).toBe(false);
  });

  it("retorna false con secreto incorrecto", () => {
    expect(verifyOnvoWebhook(body, validSig, "wrong_secret")).toBe(false);
  });

  it("retorna false si la firma fue alterada", () => {
    expect(verifyOnvoWebhook(body, validSig + "tampered", SECRET)).toBe(false);
  });

  it("retorna false si faltan parámetros", () => {
    expect(verifyOnvoWebhook(body, "", SECRET)).toBe(false);
    expect(verifyOnvoWebhook("", validSig, SECRET)).toBe(false);
    expect(verifyOnvoWebhook(body, validSig, "")).toBe(false);
  });
});
