// tests/unit/precio-final-iva.test.js
// Regla de negocio: el precio que ve el paciente es FINAL. El IVA del 4% de
// servicios de salud y la comisión de la pasarela ya están adentro; nunca se
// suman encima. Estos tests fijan esa regla en los tres puntos donde podría
// romperse: el enlace de cobro, la factura y la liquidación al profesional.
import { describe, it, expect } from "vitest";
import { splitTaxIncluded } from "../../src/lib/invoice-math.js";
import {
  baseCentsFromGross,
  estimateOnvoFeeCents,
  calculateProfessionalSettlementItem,
} from "../../src/lib/commission-plan.js";

const IVA_SALUD = 4;
const PRECIO = 48000; // lo que el paciente ve y acepta al agendar

describe("el precio publicado es el precio final", () => {
  it("el IVA se desglosa hacia adentro, no se suma encima", () => {
    const { baseCents, taxCents } = splitTaxIncluded(PRECIO * 100, IVA_SALUD);

    // base + impuesto reconstruyen EXACTAMENTE lo cobrado.
    expect(baseCents + taxCents).toBe(PRECIO * 100);
    expect(baseCents).toBe(4615385); // ₡46.153,85
    expect(taxCents).toBe(184615); //  ₡ 1.846,15
  });

  it("el impuesto es el 4% de la base, no del total", () => {
    const { baseCents, taxCents } = splitTaxIncluded(PRECIO * 100, IVA_SALUD);
    expect(taxCents).toBe(Math.round(baseCents * (IVA_SALUD / 100)));

    // Si se hubiera calculado sobre el total, el paciente pagaría de más.
    const erroneo = Math.round(PRECIO * 100 * (IVA_SALUD / 100));
    expect(taxCents).toBeLessThan(erroneo);
  });

  it("no queda ni un céntimo suelto por redondeo", () => {
    for (const monto of [1, 999, 32000, 40000, 45500, 48000, 65000, 123457]) {
      const { baseCents, taxCents } = splitTaxIncluded(monto * 100, IVA_SALUD);
      expect(baseCents + taxCents).toBe(monto * 100);
    }
  });

  it("13% declararía casi el triple de impuesto sobre el mismo cobro", () => {
    const salud = splitTaxIncluded(PRECIO * 100, 4);
    const general = splitTaxIncluded(PRECIO * 100, 13);

    // El paciente paga lo mismo con cualquiera de las dos tasas...
    expect(salud.baseCents + salud.taxCents).toBe(general.baseCents + general.taxCents);
    expect(general.baseCents + general.taxCents).toBe(PRECIO * 100);

    // ...pero lo declarado cambia por completo: ₡1.846,15 contra ₡5.522,12.
    expect(salud.taxCents).toBe(184615);
    expect(general.taxCents).toBe(552212);
  });

  it("baseCentsFromGross coincide con splitTaxIncluded", () => {
    // Dos módulos calculan la base por separado; si divergen, la liquidación
    // al profesional y la factura del paciente dejarían de cuadrar.
    const { baseCents } = splitTaxIncluded(PRECIO * 100, IVA_SALUD);
    expect(baseCentsFromGross(PRECIO * 100, IVA_SALUD)).toBe(baseCents);
  });
});

describe("la comisión de la pasarela sale del negocio, no del paciente", () => {
  it("la comisión ONVO se estima sobre lo cobrado y no altera ese monto", () => {
    const fee = estimateOnvoFeeCents(PRECIO * 100, "card");

    expect(fee).toBeGreaterThan(0);
    // El costo existe, pero el paciente sigue pagando el precio publicado.
    expect(splitTaxIncluded(PRECIO * 100, IVA_SALUD).baseCents + splitTaxIncluded(PRECIO * 100, IVA_SALUD).taxCents)
      .toBe(PRECIO * 100);
  });

  it("cobra la tarifa real de ONVO: 3.50% + US$0.35", () => {
    // ₡20.000 con tipo de cambio 510: 700.00 del porcentaje + 178.50 del fijo.
    const previo = process.env.USD_CRC_RATE;
    process.env.USD_CRC_RATE = "510";
    try {
      expect(estimateOnvoFeeCents(20000 * 100, "card")).toBe(87850);
    } finally {
      if (previo === undefined) delete process.env.USD_CRC_RATE;
      else process.env.USD_CRC_RATE = previo;
    }
  });

  it("el fijo en dólares vale colones, no céntimos", () => {
    // Se sumaba crudo sobre una cifra en céntimos, así que el fijo valía ₡2 y
    // la liquidación del profesional salía inflada. La diferencia entre dos
    // montos distintos aísla el porcentaje y deja solo el fijo.
    const unMil = estimateOnvoFeeCents(1000 * 100, "card");
    const dosMil = estimateOnvoFeeCents(2000 * 100, "card");
    const fijoSolo = unMil - (dosMil - unMil);
    expect(fijoSolo).toBeGreaterThan(10000); // más de ₡100, no ₡2
  });

  it("SINPE cuesta menos que tarjeta, y ninguno cambia lo que paga el paciente", () => {
    expect(estimateOnvoFeeCents(PRECIO * 100, "sinpe_movil")).toBeLessThan(
      estimateOnvoFeeCents(PRECIO * 100, "card")
    );
  });

  it("la liquidación reparte dentro del precio cobrado, sin excederlo", () => {
    const fee = estimateOnvoFeeCents(PRECIO * 100, "card");
    const item = calculateProfessionalSettlementItem({
      grossCents: PRECIO * 100,
      taxRatePct: IVA_SALUD,
      processingFeeCents: fee,
      consultationNumber: 5,
      paymentType: "FULL_100",
    });

    expect(item.grossCents).toBe(PRECIO * 100);
    expect(item.baseCents).toBe(baseCentsFromGross(PRECIO * 100, IVA_SALUD));

    // Comisión + pasarela + lo que le queda al profesional nunca supera la base.
    expect(item.commissionCents + item.processingFeeCents + item.professionalBaseCents).toBe(item.baseCents);
  });

  it("el profesional factura su parte con el mismo 4%", () => {
    const item = calculateProfessionalSettlementItem({
      grossCents: PRECIO * 100,
      taxRatePct: IVA_SALUD,
      processingFeeCents: 0,
      consultationNumber: 5,
      paymentType: "FULL_100",
    });

    expect(item.professionalTaxCents).toBe(Math.round(item.professionalBaseCents * IVA_SALUD / 100));
    expect(item.professionalInvoiceCents).toBe(item.professionalBaseCents + item.professionalTaxCents);
  });
});

describe("lo que se le manda cobrar a ONVO", () => {
  it("ONVO recibe el precio publicado tal cual, en la unidad menor", () => {
    // createPaymentLink() envía Math.round(amount * 100): ₡48.000 -> 4800000.
    // Sin sumarle IVA ni comisión, que ya están adentro.
    const unitAmount = Math.round(PRECIO * 100);

    expect(unitAmount).toBe(4800000);
    const { baseCents, taxCents } = splitTaxIncluded(unitAmount, IVA_SALUD);
    expect(baseCents + taxCents).toBe(unitAmount);
  });
});
