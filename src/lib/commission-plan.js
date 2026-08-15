export const COMMISSION_PLAN_VERSION = "patient-retention-2026-07";

export const FIRST_APPOINTMENT_PAYMENT_RATES = Object.freeze({
  DEPOSIT_50: 50,
  BALANCE_50: 40,
  FULL_100: 45,
});

export const COMMISSION_SEQUENCE_TIERS = Object.freeze([
  { fromConsultation: 1, toConsultation: 1, ratePct: 45 },
  { fromConsultation: 2, toConsultation: 2, ratePct: 35 },
  { fromConsultation: 3, toConsultation: 3, ratePct: 30 },
  { fromConsultation: 4, toConsultation: 4, ratePct: 25 },
  { fromConsultation: 5, toConsultation: 8, ratePct: 20 },
  { fromConsultation: 9, toConsultation: 28, ratePct: 15 },
  { fromConsultation: 29, toConsultation: Number.POSITIVE_INFINITY, ratePct: 10 },
]);

export function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function baseCentsFromGross(grossCents, taxRatePct = 4) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const rate = Number(taxRatePct);
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Tasa de impuesto inválida.");
  return Math.round(gross / (1 + rate / 100));
}

// Tarifa vigente de ONVO para tarjeta (Visa/MC/AMEX/Google Pay en ecommerce,
// locales e internacionales): 3.50% + US$0.35. El porcentaje se aplica sobre el
// monto cobrado; el fijo se cobra EN DÓLARES, así que hay que convertirlo a
// colones para poder restarlo de un cobro en CRC.
//
// Las tarifas de SINPE no vienen confirmadas por ONVO; quedan como estimación
// hasta tener el dato oficial.
const ONVO_CARD_RATE_PCT = 3.5;
const ONVO_CARD_FIXED_USD = 0.35;
const USD_CRC_FALLBACK = 510;

/** Tipo de cambio vigente para convertir el fijo en dólares de ONVO. */
export function usdToCrc() {
  const configurado = Number(process.env.USD_CRC_RATE);
  return Number.isFinite(configurado) && configurado > 0 ? configurado : USD_CRC_FALLBACK;
}

/**
 * Desglose del costo de pasarela de un cobro.
 *
 * ONVO cobra dos cosas distintas y conviene no mezclarlas: un porcentaje sobre
 * el monto, que nace y muere en colones, y un fijo POR TRANSACCIÓN que cobra en
 * dólares. El fijo es una cantidad, no una proporción: no crece con el monto,
 * así que sobre un cobro chico pesa mucho más.
 *
 * Se devuelven los dos por separado, junto con el tipo de cambio aplicado,
 * porque la liquidación de ONVO va a venir con SU tipo de cambio del día y sin
 * esto no habría cómo cuadrar la diferencia. El total en colones es una
 * estimación; los US$0.35 son el dato firme.
 *
 * @returns {{percentCents:number, ratePct:number, fixedUsd:number,
 *            usdCrcRate:number, fixedCents:number, totalCents:number}}
 */
export function estimateOnvoFee(grossCents, method = "card") {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const normalized = String(method || "card").toLowerCase();
  const esSinpe = normalized.includes("sinpe");

  const ratePct = normalized.includes("sinpe_movil")
    ? Number(process.env.ONVO_SINPE_MOVIL_RATE || 1.5)
    : esSinpe
      ? Number(process.env.ONVO_SINPE_RATE || 2.5)
      : Number(process.env.ONVO_CARD_RATE || ONVO_CARD_RATE_PCT);

  const percentCents = Math.max(0, Math.round((gross * ratePct) / 100));

  // SINPE no lleva fijo en dólares; si algún día lo lleva, se declara en colones.
  const fixedUsd = esSinpe ? 0 : Number(process.env.ONVO_CARD_FIXED_FEE_USD || ONVO_CARD_FIXED_USD);
  const usdCrcRate = usdToCrc();
  const fixedColones = esSinpe
    ? Number(process.env.ONVO_SINPE_FIXED_FEE_CRC || 0)
    : fixedUsd * usdCrcRate;

  // El fijo se venía sumando crudo sobre una cifra en céntimos, así que los
  // "₡200" del default valían ₡2 y al profesional se le liquidaba de más.
  const fixedCents = Math.max(0, Math.round(fixedColones * 100));

  return {
    percentCents,
    ratePct,
    fixedUsd,
    usdCrcRate,
    fixedCents,
    totalCents: percentCents + fixedCents,
  };
}

/**
 * Costo estimado de la pasarela, en céntimos de colón.
 *
 * Es una estimación: el cobro real de ONVO aparece en su liquidación y puede
 * diferir por el tipo de cambio del día. Se usa para saber cuánto queda después
 * de la pasarela, nunca para alterar lo que paga el paciente — el precio
 * publicado es final.
 */
export function estimateOnvoFeeCents(grossCents, method = "card") {
  return estimateOnvoFee(grossCents, method).totalCents;
}

function normalizeConsultationNumber(value) {
  const consultationNumber = Number(value);
  if (!Number.isInteger(consultationNumber) || consultationNumber < 1) {
    throw new Error("Número de consulta inválido.");
  }
  return consultationNumber;
}

export function commissionRateForConsultation(consultationNumber) {
  const normalized = normalizeConsultationNumber(consultationNumber);
  const tier = COMMISSION_SEQUENCE_TIERS.find(
    ({ fromConsultation, toConsultation }) =>
      normalized >= fromConsultation && normalized <= toConsultation
  );
  if (!tier) throw new Error("No existe una tasa para la consulta indicada.");
  return tier.ratePct;
}

export function commissionRateForPayment({ consultationNumber, paymentType = "FULL_100" }) {
  const normalized = normalizeConsultationNumber(consultationNumber);
  const type = String(paymentType || "FULL_100");

  if (normalized === 1 && FIRST_APPOINTMENT_PAYMENT_RATES[type] !== undefined) {
    return FIRST_APPOINTMENT_PAYMENT_RATES[type];
  }

  return commissionRateForConsultation(normalized);
}

export function consultationRelationshipKey(patientId, professionalId) {
  const patient = String(patientId || "");
  const professional = String(professionalId || "");
  if (!patient || !professional) throw new Error("Relación paciente-profesional inválida.");
  return `${patient}:${professional}`;
}

/**
 * Numbers completed appointments chronologically for each patient-professional
 * relationship. The sequence is independent from settlement periods.
 */
export function buildConsultationNumberMap(appointments) {
  const ordered = [...(appointments || [])].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.id).localeCompare(String(right.id));
  });

  const counters = new Map();
  const consultationNumbers = new Map();

  for (const appointment of ordered) {
    if (!appointment?.id) throw new Error("Cita sin identificador.");
    const key = consultationRelationshipKey(
      appointment.patientId,
      appointment.professionalId
    );
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    consultationNumbers.set(appointment.id, next);
  }

  return consultationNumbers;
}

export function calculateProfessionalSettlementItem({
  grossCents,
  taxRatePct = 4,
  processingFeeCents = 0,
  consultationNumber,
  paymentType = "FULL_100",
}) {
  const baseCents = baseCentsFromGross(grossCents, taxRatePct);
  const ratePct = commissionRateForPayment({ consultationNumber, paymentType });
  const commissionCents = Math.round(baseCents * ratePct / 100);
  const fee = Math.max(0, Math.round(Number(processingFeeCents) || 0));
  const professionalBaseCents = Math.max(0, baseCents - commissionCents - fee);
  const professionalTaxCents = Math.round(
    professionalBaseCents * Number(taxRatePct) / 100
  );

  return {
    grossCents: Math.round(Number(grossCents) || 0),
    baseCents,
    commissionCents,
    ratePct,
    effectiveRatePct: ratePct,
    consultationNumber: normalizeConsultationNumber(consultationNumber),
    paymentType,
    processingFeeCents: fee,
    professionalBaseCents,
    professionalTaxCents,
    professionalInvoiceCents: professionalBaseCents + professionalTaxCents,
    breakdown: [{ amountCents: baseCents, ratePct, commissionCents }],
  };
}
