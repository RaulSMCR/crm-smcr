// tests/unit/exchange-rate.test.js
// El tipo de cambio decide cuánto se le descuenta al profesional por la
// pasarela. Un error acá no rompe nada visiblemente: solo liquida mal.
import { describe, it, expect } from "vitest";
import { diaDeHoyCR, TIPO_CAMBIO_FALLBACK } from "../../src/lib/exchange-rate.js";
import { estimateOnvoFee } from "../../src/lib/commission-plan.js";

describe("diaDeHoyCR()", () => {
  it("agrupa por el día costarricense, no por el del servidor", () => {
    // Vercel corre en UTC. A las 02:00 UTC en Costa Rica todavía es el día
    // anterior: sin corregirlo, los cobros de la noche caerían en el día
    // siguiente y usarían un tipo de cambio que aún no existe.
    const madrugadaUTC = new Date("2026-08-16T02:00:00Z"); // 20:00 del 15 en CR
    expect(diaDeHoyCR(madrugadaUTC).toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("después de las 6:00 UTC ya es el mismo día en ambos husos", () => {
    const manana = new Date("2026-08-16T14:00:00Z"); // 08:00 del 16 en CR
    expect(diaDeHoyCR(manana).toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });
});

describe("el tipo de cambio entra en el cálculo de la comisión", () => {
  it("el que se pasa manda sobre la variable de entorno", () => {
    const previo = process.env.USD_CRC_RATE;
    process.env.USD_CRC_RATE = "510";
    try {
      const conTasaDelDia = estimateOnvoFee(20000 * 100, "card", { usdCrcRate: 540 });
      expect(conTasaDelDia.usdCrcRate).toBe(540);
      expect(conTasaDelDia.fixedCents).toBe(18900); // 0.35 × 540 = ₡189
    } finally {
      if (previo === undefined) delete process.env.USD_CRC_RATE;
      else process.env.USD_CRC_RATE = previo;
    }
  });

  it("un valor inservible no rompe el cobro: cae al de entorno", () => {
    // Pasa si la base no tiene dato y la descarga falló. Preferimos una
    // estimación vieja antes que abortar un cobro en curso.
    const previo = process.env.USD_CRC_RATE;
    process.env.USD_CRC_RATE = "510";
    try {
      for (const malo of [null, undefined, 0, -3, NaN, "quinientos"]) {
        expect(estimateOnvoFee(20000 * 100, "card", { usdCrcRate: malo }).usdCrcRate).toBe(510);
      }
    } finally {
      if (previo === undefined) delete process.env.USD_CRC_RATE;
      else process.env.USD_CRC_RATE = previo;
    }
  });

  it("el tipo de cambio solo mueve el fijo, nunca el porcentaje", () => {
    const a = estimateOnvoFee(20000 * 100, "card", { usdCrcRate: 500 });
    const b = estimateOnvoFee(20000 * 100, "card", { usdCrcRate: 600 });
    expect(a.percentCents).toBe(b.percentCents);
    expect(b.fixedCents).toBeGreaterThan(a.fixedCents);
  });

  it("SINPE no depende del dólar", () => {
    const a = estimateOnvoFee(20000 * 100, "sinpe_movil", { usdCrcRate: 500 });
    const b = estimateOnvoFee(20000 * 100, "sinpe_movil", { usdCrcRate: 900 });
    expect(a.totalCents).toBe(b.totalCents);
  });

  it("el fallback es un número usable", () => {
    expect(TIPO_CAMBIO_FALLBACK).toBeGreaterThan(100);
    expect(TIPO_CAMBIO_FALLBACK).toBeLessThan(2000);
  });
});
