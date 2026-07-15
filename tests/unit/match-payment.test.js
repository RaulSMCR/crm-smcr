// tests/unit/match-payment.test.js
// Tests del emparejamiento de pagos ONVO (PAY-01). Función pura, sin mocks.
import { describe, it, expect } from "vitest";
import { matchTransaction, normalizeEventAmount, ONVO_AMOUNT_DIVISOR } from "../../src/lib/onvo/match-payment.js";

function tx(id, amount, email, currency = "CRC") {
  return { id, amount, currency, patientEmail: email };
}

describe("matchTransaction()", () => {
  it("empareja cuando hay una candidata con monto y email coincidentes", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.match).toBeDefined();
    expect(res.match.id).toBe("t1");
  });

  it("con dos candidatas del mismo monto → MULTIPLE_CANDIDATES (no adivina)", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr"), tx("t2", 45500, "beto@x.cr")];
    // Sin email en el evento no se puede desambiguar.
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc" });
    expect(res.match).toBeUndefined();
    expect(res.unmatchedReason).toBe("MULTIPLE_CANDIDATES");
  });

  it("con monto distinto → AMOUNT_MISMATCH", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 3000000, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
  });

  it("con email distinto → EMAIL_MISMATCH", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc", customerEmail: "otro@x.cr" });
    expect(res.unmatchedReason).toBe("EMAIL_MISMATCH");
  });

  it("si el evento no trae email, empareja por monto", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc" });
    expect(res.match?.id).toBe("t1");
  });

  it("sin candidatas → NO_TRANSACTION", () => {
    const res = matchTransaction([], { amount: 45500, currency: "crc" });
    expect(res.unmatchedReason).toBe("NO_TRANSACTION");
  });

  it("desambigua por email cuando dos candidatas comparten monto", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr"), tx("t2", 45500, "beto@x.cr")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc", customerEmail: "BETO@x.cr" });
    expect(res.match?.id).toBe("t2");
  });

  it("la moneda se compara sin distinguir mayúsculas/minúsculas", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr", "CRC")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.match?.id).toBe("t1");
  });

  it("moneda distinta → AMOUNT_MISMATCH (mismo filtro monto/moneda)", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr", "CRC")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "usd", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
  });
});

describe("normalizeEventAmount()", () => {
  it("aplica el divisor documentado (1:1 para CRC)", () => {
    expect(ONVO_AMOUNT_DIVISOR).toBe(100);
    expect(normalizeEventAmount(4550000)).toBe(45500);
  });

  it("devuelve null para montos no numéricos", () => {
    expect(normalizeEventAmount(undefined)).toBeNull();
    expect(normalizeEventAmount("abc")).toBeNull();
  });
});
