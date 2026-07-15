// tests/unit/match-payment.test.js
// Tests del emparejamiento de pagos ONVO (PAY-01). Función pura, sin mocks.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  matchTransaction,
  normalizeEventAmount,
  getOnvoAmountDivisor,
  DEFAULT_ONVO_AMOUNT_DIVISOR,
} from "../../src/lib/onvo/match-payment.js";

function tx(id, amount, email, currency = "CRC") {
  return { id, amount, currency, patientEmail: email };
}

// El divisor se lee del entorno en cada llamada: cada test parte del default.
const envBackup = process.env.ONVO_AMOUNT_DIVISOR;
beforeEach(() => {
  delete process.env.ONVO_AMOUNT_DIVISOR;
});
afterEach(() => {
  if (envBackup === undefined) delete process.env.ONVO_AMOUNT_DIVISOR;
  else process.env.ONVO_AMOUNT_DIVISOR = envBackup;
});

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
  it("aplica el divisor por defecto (centésimos de colón)", () => {
    expect(DEFAULT_ONVO_AMOUNT_DIVISOR).toBe(100);
    expect(normalizeEventAmount(4550000)).toBe(45500);
  });

  it("devuelve null para montos no numéricos", () => {
    expect(normalizeEventAmount(undefined)).toBeNull();
    expect(normalizeEventAmount("abc")).toBeNull();
  });
});

describe("getOnvoAmountDivisor()", () => {
  it("usa el default cuando no hay env", () => {
    expect(getOnvoAmountDivisor()).toBe(DEFAULT_ONVO_AMOUNT_DIVISOR);
  });

  it("respeta ONVO_AMOUNT_DIVISOR del entorno", () => {
    process.env.ONVO_AMOUNT_DIVISOR = "1";
    expect(getOnvoAmountDivisor()).toBe(1);
    expect(normalizeEventAmount(45500)).toBe(45500);
  });

  it("cae al default si el env es inválido o no positivo", () => {
    for (const value of ["abc", "0", "-100", ""]) {
      process.env.ONVO_AMOUNT_DIVISOR = value;
      expect(getOnvoAmountDivisor()).toBe(DEFAULT_ONVO_AMOUNT_DIVISOR);
    }
  });
});

describe("matchTransaction() — divisor configurable", () => {
  it("con ONVO_AMOUNT_DIVISOR=1 empareja montos en colones enteros", () => {
    process.env.ONVO_AMOUNT_DIVISOR = "1";
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 45500, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.match?.id).toBe("t1");
  });

  it("mismatch por unidad: con divisor 100 activo, avisa que con 1 sí coincidiría", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    // ONVO manda colones enteros pero el divisor configurado es 100.
    const res = matchTransaction(candidates, { amount: 45500, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
    expect(res.unmatchedDetail).toBe(
      "AMOUNT_MISMATCH (posible unidad incorrecta: con divisor 1 sí coincide — revisar ONVO_AMOUNT_DIVISOR)"
    );
  });

  it("mismatch por unidad: con divisor 1 activo, avisa que con 100 sí coincidiría", () => {
    process.env.ONVO_AMOUNT_DIVISOR = "1";
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
    expect(res.unmatchedDetail).toContain("con divisor 100 sí coincide");
  });

  it("sin pista cuando el monto no coincide con ningún divisor", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 3000000, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
    expect(res.unmatchedDetail).toBeUndefined();
  });

  it("sin pista cuando el mismatch es de moneda, no de unidad", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr", "CRC")];
    const res = matchTransaction(candidates, { amount: 4550000, currency: "usd", customerEmail: "ana@x.cr" });
    expect(res.unmatchedReason).toBe("AMOUNT_MISMATCH");
    expect(res.unmatchedDetail).toBeUndefined();
  });

  it("nunca acredita con el divisor alternativo: solo diagnostica", () => {
    const candidates = [tx("t1", 45500, "ana@x.cr")];
    const res = matchTransaction(candidates, { amount: 45500, currency: "crc", customerEmail: "ana@x.cr" });
    expect(res.match).toBeUndefined();
  });
});
