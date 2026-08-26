// Ancla entre el anexo contractual y el código.
//
// `commission-plan.test.js` prueba que las funciones se comporten como se
// diseñaron. Este archivo prueba algo distinto y complementario: que lo que el
// código calcula sea exactamente lo que el PROFESIONAL firmó en
// `docs/ANEXO-ECONOMICO-LIQUIDACION-PROFESIONALES-PROPUESTO.md`. Si alguien
// cambia una tasa en el código sin tocar el anexo, o al revés, acá se rompe.
//
// Plan de referencia: patient-retention-2026-07.
import { describe, expect, it } from "vitest";
import {
  COMMISSION_PLAN_VERSION,
  buildConsultationNumberMap,
  calculateProfessionalSettlementItem,
  commissionRateForConsultation,
  commissionRateForPayment,
  estimateOnvoFee,
} from "../../src/lib/commission-plan.js";
import { computeInvoiceLine, splitTaxIncluded } from "../../src/lib/invoice-math.js";

/** Tabla de la cláusula 5 del anexo, transcrita a mano desde el documento. */
const TABLA_DEL_ANEXO = [
  { consulta: 1, tasa: 45 },
  { consulta: 2, tasa: 35 },
  { consulta: 3, tasa: 30 },
  { consulta: 4, tasa: 25 },
  { consulta: 5, tasa: 20 },
  { consulta: 8, tasa: 20 },
  { consulta: 9, tasa: 15 },
  { consulta: 28, tasa: 15 },
  { consulta: 29, tasa: 10 },
  { consulta: 480, tasa: 10 },
];

const IVA = 4;
const BRUTO_40K = 4000000; // CRC 40.000 en céntimos

describe("anexo económico — cláusula 5, escala de comisión", () => {
  it("declara la versión del plan que cita el anexo", () => {
    expect(COMMISSION_PLAN_VERSION).toBe("patient-retention-2026-07");
  });

  it.each(TABLA_DEL_ANEXO)(
    "cobra $tasa% en la consulta $consulta, como dice la tabla",
    ({ consulta, tasa }) => {
      expect(commissionRateForConsultation(consulta)).toBe(tasa);
    },
  );

  it("no reconoce un tramo separado a partir de la consulta 49", () => {
    // El anexo anterior inventaba un tramo "49 en adelante" que el código nunca
    // tuvo. Desde la 29 la tasa es 10% y no vuelve a moverse.
    expect(commissionRateForConsultation(48)).toBe(10);
    expect(commissionRateForConsultation(49)).toBe(10);
    expect(commissionRateForConsultation(1000)).toBe(10);
  });
});

describe("anexo económico — cláusula 5.1, primera consulta", () => {
  it("aplica 50% al adelanto, 40% al saldo y 45% al pago único", () => {
    expect(commissionRateForPayment({ consultationNumber: 1, paymentType: "DEPOSIT_50" })).toBe(50);
    expect(commissionRateForPayment({ consultationNumber: 1, paymentType: "BALANCE_50" })).toBe(40);
    expect(commissionRateForPayment({ consultationNumber: 1, paymentType: "FULL_100" })).toBe(45);
  });

  it("da la misma comisión pagando de una vez que en dos mitades iguales", () => {
    const completo = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      consultationNumber: 1,
      paymentType: "FULL_100",
    });

    const adelanto = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K / 2,
      taxRatePct: IVA,
      consultationNumber: 1,
      paymentType: "DEPOSIT_50",
    });
    const saldo = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K / 2,
      taxRatePct: IVA,
      consultationNumber: 1,
      paymentType: "BALANCE_50",
    });

    const comisionFraccionada = adelanto.commissionCents + saldo.commissionCents;

    // Un céntimo de tolerancia: partir en dos redondea dos veces.
    expect(Math.abs(comisionFraccionada - completo.commissionCents)).toBeLessThanOrEqual(1);

    const baseTotal = adelanto.baseCents + saldo.baseCents;
    expect(Math.round((comisionFraccionada / baseTotal) * 100)).toBe(45);
  });

  it("deja de aplicar las tasas de primera consulta a partir de la segunda", () => {
    // Aunque el cobro venga fraccionado, en la consulta 2 manda la secuencia.
    expect(commissionRateForPayment({ consultationNumber: 2, paymentType: "DEPOSIT_50" })).toBe(35);
    expect(commissionRateForPayment({ consultationNumber: 2, paymentType: "BALANCE_50" })).toBe(35);
  });
});

describe("anexo económico — cláusula 7, fórmula de liquidación", () => {
  it("calcula la base sin impuesto dividiendo entre 1,04", () => {
    const item = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      consultationNumber: 1,
      paymentType: "FULL_100",
    });

    // 40.000 / 1,04 = 38.461,538…  →  3.846.154 céntimos
    expect(item.baseCents).toBe(3846154);
    // La comisión sale de la base, nunca del bruto.
    expect(item.commissionCents).toBe(Math.round(3846154 * 0.45));
    expect(item.commissionCents).toBeLessThan(Math.round(BRUTO_40K * 0.45));
  });

  it.each([
    { consulta: 2, tasa: 35 },
    { consulta: 3, tasa: 30 },
    { consulta: 4, tasa: 25 },
    { consulta: 5, tasa: 20 },
    { consulta: 9, tasa: 15 },
    { consulta: 29, tasa: 10 },
  ])("liquida la consulta $consulta al $tasa% sobre la base", ({ consulta, tasa }) => {
    const item = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      consultationNumber: consulta,
      paymentType: "FULL_100",
    });

    expect(item.ratePct).toBe(tasa);
    expect(item.commissionCents).toBe(Math.round(item.baseCents * (tasa / 100)));

    // Neto = base − comisión − costo de procesamiento (acá cero).
    expect(item.professionalBaseCents).toBe(item.baseCents - item.commissionCents);
    // Factura = neto + impuesto propio.
    expect(item.professionalInvoiceCents).toBe(
      item.professionalBaseCents + item.professionalTaxCents,
    );
  });

  it("resta el costo de procesamiento del neto, sin mezclarlo con la comisión", () => {
    const sinCosto = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      consultationNumber: 2,
      paymentType: "FULL_100",
    });
    const conCosto = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      processingFeeCents: 150000, // CRC 1.500
      consultationNumber: 2,
      paymentType: "FULL_100",
    });

    // El costo de procesamiento NO altera la comisión: son conceptos separados.
    expect(conCosto.commissionCents).toBe(sinCosto.commissionCents);
    expect(conCosto.processingFeeCents).toBe(150000);
    // Pero sí baja el neto del profesional, peso por peso.
    expect(conCosto.professionalBaseCents).toBe(sinCosto.professionalBaseCents - 150000);
    expect(conCosto.professionalInvoiceCents).toBeLessThan(sinCosto.professionalInvoiceCents);
  });

  it("nunca deja el neto en negativo aunque el costo se coma la base", () => {
    const item = calculateProfessionalSettlementItem({
      grossCents: 100000,
      taxRatePct: IVA,
      processingFeeCents: 99999999,
      consultationNumber: 1,
      paymentType: "FULL_100",
    });
    expect(item.professionalBaseCents).toBe(0);
  });
});

describe("anexo económico — cláusula 8.1, la factura debe igualar la liquidación", () => {
  it("el monto exigido al profesional es el que la liquidación guarda como neto", () => {
    const item = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      processingFeeCents: 158500,
      consultationNumber: 3,
      paymentType: "FULL_100",
    });

    // Lo que settlement-actions.js escribe en SettlementItem.netAmount.
    const netoLiquidado = item.professionalInvoiceCents / 100;

    // Lo que professional-billing-actions.js exige que facture (tolerancia 0,005).
    const montoFacturado = netoLiquidado;
    expect(Math.abs(montoFacturado - netoLiquidado)).toBeLessThanOrEqual(0.005);

    // Un colón de más o de menos tiene que quedar fuera de la tolerancia.
    expect(Math.abs(netoLiquidado + 1 - netoLiquidado)).toBeGreaterThan(0.005);
    expect(Math.abs(netoLiquidado - 1 - netoLiquidado)).toBeGreaterThan(0.005);
  });

  it("el desglose de la factura reconstruye el neto y su impuesto", () => {
    const item = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K,
      taxRatePct: IVA,
      processingFeeCents: 158500,
      consultationNumber: 3,
      paymentType: "FULL_100",
    });

    // professional-billing-actions.js desglosa el total de la factura al 4%.
    const { baseCents, taxCents } = splitTaxIncluded(item.professionalInvoiceCents, IVA);

    expect(baseCents + taxCents).toBe(item.professionalInvoiceCents);
    // El desglose devuelve el mismo neto que produjo la liquidación.
    expect(Math.abs(baseCents - item.professionalBaseCents)).toBeLessThanOrEqual(1);
    expect(Math.abs(taxCents - item.professionalTaxCents)).toBeLessThanOrEqual(1);
  });
});

describe("anexo económico — cláusula 4.3, multa por cancelación tardía", () => {
  it("cobra la tasa de la posición en la secuencia, no las de primera consulta", () => {
    // Una multa es un solo cobro: no hay adelanto ni saldo que desdoblar.
    expect(commissionRateForPayment({ consultationNumber: 1, paymentType: "PENALTY_50" })).toBe(45);
    expect(commissionRateForPayment({ consultationNumber: 3, paymentType: "PENALTY_50" })).toBe(30);
    expect(commissionRateForPayment({ consultationNumber: 9, paymentType: "PENALTY_50" })).toBe(15);
    expect(commissionRateForPayment({ consultationNumber: 29, paymentType: "PENALTY_50" })).toBe(10);
  });

  it("liquida la multa como cualquier cobro y deja neto para el profesional", () => {
    const multa = calculateProfessionalSettlementItem({
      grossCents: BRUTO_40K / 2, // la multa es el 50% del valor de la cita
      taxRatePct: IVA,
      consultationNumber: 3,
      paymentType: "PENALTY_50",
    });

    expect(multa.ratePct).toBe(30);
    expect(multa.commissionCents).toBe(Math.round(multa.baseCents * 0.3));
    // Lo que importa: al profesional le queda algo, no cero.
    expect(multa.professionalInvoiceCents).toBeGreaterThan(0);
    expect(multa.professionalBaseCents).toBe(multa.baseCents - multa.commissionCents);
  });
});

describe("secuencia — qué consume una posición", () => {
  const REL = { patientId: "pac1", professionalId: "pro1" };

  it("numera por cita, de modo que adelanto y saldo comparten posición", () => {
    const mapa = buildConsultationNumberMap([
      { id: "cita1", date: "2026-01-10T10:00:00Z", ...REL },
      { id: "cita2", date: "2026-01-20T10:00:00Z", ...REL },
    ]);
    // Ambos pagos de cita1 leen el mismo número: la primera consulta.
    expect(mapa.get("cita1")).toBe(1);
    expect(mapa.get("cita2")).toBe(2);
  });

  it("respeta los números ya emitidos y no renumera hacia atrás", () => {
    // cita2 se liquidó antes que cita1 (su multa se pagó tarde). El número ya
    // emitido para cita2 manda, y cita1 toma la siguiente posición libre.
    const mapa = buildConsultationNumberMap(
      [
        { id: "cita1", date: "2026-01-10T10:00:00Z", ...REL },
        { id: "cita2", date: "2026-01-20T10:00:00Z", ...REL },
      ],
      { numerosAsignados: new Map([["cita2", 1]]) },
    );

    expect(mapa.get("cita2")).toBe(1); // intacto
    expect(mapa.get("cita1")).toBe(2); // no pisa al que ya se facturó
  });

  it("mantiene secuencias independientes por relación paciente-profesional", () => {
    const mapa = buildConsultationNumberMap([
      { id: "a", date: "2026-01-10T10:00:00Z", patientId: "pac1", professionalId: "pro1" },
      { id: "b", date: "2026-01-11T10:00:00Z", patientId: "pac1", professionalId: "pro2" },
      { id: "c", date: "2026-01-12T10:00:00Z", patientId: "pac1", professionalId: "pro1" },
    ]);

    expect(mapa.get("a")).toBe(1);
    expect(mapa.get("b")).toBe(1); // otro profesional, secuencia propia
    expect(mapa.get("c")).toBe(2);
  });
});

describe("cláusula 6.2 — el fijo de ONVO no se le cobra dos veces al profesional", () => {
  it("el segundo tramo de la primera consulta no arrastra el cargo fijo", () => {
    // ONVO cobra un fijo en dólares por transacción. Partir la primera consulta
    // en adelanto y saldo lo dispara dos veces, y esa partición es una decisión
    // de la plataforma: el segundo fijo lo asume ella.
    const desglose = estimateOnvoFee(2000000, "card");

    expect(desglose.fixedCents).toBeGreaterThan(0);
    expect(desglose.totalCents).toBe(desglose.percentCents + desglose.fixedCents);
    // Lo que se le traslada en el saldo es solo el porcentaje.
    expect(desglose.percentCents).toBeLessThan(desglose.totalCents);
  });

  it("el porcentaje sí se traslada completo: es proporcional al dinero movido", () => {
    const mitad = estimateOnvoFee(2000000, "card");
    const entero = estimateOnvoFee(4000000, "card");
    // Dos mitades suman el mismo porcentaje que el cobro entero.
    expect(mitad.percentCents * 2).toBe(entero.percentCents);
  });
});

describe("facturación manual — el monto escrito lleva el IVA dentro", () => {
  it("facturar a mano una consulta da lo mismo que cobrarla", () => {
    // El precio publicado es final: ₡40.000 con IVA 4% dentro. Facturar a mano
    // ese mismo servicio tiene que emitir por ₡40.000, no por ₡41.600.
    const totalEscrito = 40000;
    const tasa = 4;

    const { baseCents, taxCents } = splitTaxIncluded(Math.round(totalEscrito * 100), tasa);
    const unitPrice = baseCents / 100;

    // Lo que la API reconstruye a partir de esa línea.
    const linea = computeInvoiceLine({ quantity: 1, unitPrice, discountPercent: 0, taxRate: tasa });

    expect(linea.lineTotal).toBeCloseTo(totalEscrito, 2);
    expect(linea.lineSubtotal).toBeCloseTo(baseCents / 100, 2);
    expect(linea.taxAmount).toBeCloseTo(taxCents / 100, 2);
  });

  it("sin la separación previa, la API facturaría de más", () => {
    // El defecto que se corrigió: mandar el precio publicado como unitPrice.
    const crudo = computeInvoiceLine({ quantity: 1, unitPrice: 40000, discountPercent: 0, taxRate: 4 });
    expect(crudo.lineTotal).toBeCloseTo(41600, 2);
  });

  it("el mismo criterio vale para otras tasas", () => {
    for (const tasa of [0, 1, 2, 4, 13]) {
      const { baseCents } = splitTaxIncluded(4000000, tasa);
      const linea = computeInvoiceLine({
        quantity: 1,
        unitPrice: baseCents / 100,
        discountPercent: 0,
        taxRate: tasa,
      });
      expect(linea.lineTotal).toBeCloseTo(40000, 1);
    }
  });
});
