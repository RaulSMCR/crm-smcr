// tests/unit/webhook-verify.test.js
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "../../src/lib/placetopay/webhook.js";

const SECRET = "test_secret_key";

function makeSignature(requestId, status, date) {
  return crypto
    .createHash("sha1")
    .update(`${requestId}${status}${date}${SECRET}`)
    .digest("hex");
}

describe("verifyWebhookSignature()", () => {
  const requestId = 12345;
  const status    = "APPROVED";
  const date      = "2026-03-06T10:00:00-06:00";
  const signature = makeSignature(requestId, status, date);

  it("retorna true con firma válida", () => {
    expect(
      verifyWebhookSignature({ requestId, status, date, signature, secretKey: SECRET })
    ).toBe(true);
  });

  it("retorna false si la firma fue alterada", () => {
    expect(
      verifyWebhookSignature({
        requestId,
        status,
        date,
        signature: signature + "tampered",
        secretKey: SECRET,
      })
    ).toBe(false);
  });

  it("retorna false con secretKey distinto", () => {
    expect(
      verifyWebhookSignature({
        requestId,
        status,
        date,
        signature,
        secretKey: "wrong_secret",
      })
    ).toBe(false);
  });

  it("retorna false si status es distinto", () => {
    expect(
      verifyWebhookSignature({
        requestId,
        status: "REJECTED",
        date,
        signature,
        secretKey: SECRET,
      })
    ).toBe(false);
  });

  it("retorna false si requestId es distinto", () => {
    expect(
      verifyWebhookSignature({
        requestId: 99999,
        status,
        date,
        signature,
        secretKey: SECRET,
      })
    ).toBe(false);
  });

  it("retorna false si faltan campos", () => {
    expect(verifyWebhookSignature({ requestId, status, date, secretKey: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ requestId, status, signature, secretKey: SECRET })).toBe(false);
    expect(verifyWebhookSignature({})).toBe(false);
  });
});
