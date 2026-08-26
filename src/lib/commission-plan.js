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
export function estimateOnvoFee(grossCents, method = "card", { usdCrcRate } = {}) {
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
  // El tipo de cambio del día se resuelve fuera (lib/exchange-rate, que consulta
  // la base) y se pasa acá. Sin él, se cae a la variable de entorno: este módulo
  // es síncrono a propósito, para que se pueda calcular en un test sin base.
  const tipoCambio = Number.isFinite(Number(usdCrcRate)) && Number(usdCrcRate) > 0
    ? Number(usdCrcRate)
    : usdToCrc();
  const fixedColones = esSinpe
    ? Number(process.env.ONVO_SINPE_FIXED_FEE_CRC || 0)
    : fixedUsd * tipoCambio;

  // El fijo se venía sumando crudo sobre una cifra en céntimos, así que los
  // "₡200" del default valían ₡2 y al profesional se le liquidaba de más.
  const fixedCents = Math.max(0, Math.round(fixedColones * 100));

  return {
    percentCents,
    ratePct,
    fixedUsd,
    usdCrcRate: tipoCambio,
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
export function estimateOnvoFeeCents(grossCents, method = "card", opciones) {
  return estimateOnvoFee(grossCents, method, opciones).totalCents;
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

/**
 * Tasa aplicable a un pago concreto.
 *
 * `PENALTY_50` —la multa por cancelar con menos de 24 horas o no asistir— paga
 * la tasa que le correspondía a esa consulta por su posición en la secuencia, y
 * no las tasas especiales de primera consulta. El desdoble 50/40 existe porque
 * el precio de la primera consulta se cobra en dos tractos; una multa es un solo
 * cobro, así que no hay nada que desdoblar: si se cancela tarde la primera cita,
 * la multa paga 45%, igual que un pago único.
 */
export function commissionRateForPayment({ consultationNumber, paymentType = "FULL_100" }) {
  const normalized = normalizeConsultationNumber(consultationNumber);
  const type = String(paymentType || "FULL_100");

  if (type === "PENALTY_50") return commissionRateForConsultation(normalized);

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
 * Numera cronológicamente las citas de cada relación paciente–profesional. La
 * secuencia es independiente de los períodos de liquidación.
 *
 * **Qué consume una posición.** No es haber prestado la consulta, sino haberla
 * cobrado: una cita cancelada fuera de tiempo cuya multa el paciente pagó ocupa
 * su número igual que una consulta realizada, porque el horario se apartó y se
 * facturó. Quien llama decide qué citas entran; acá solo se numeran. Una cita
 * cancelada cuya multa nadie pagó no debe llegar hasta acá.
 *
 * **Por qué se numera por cita y no por transacción.** El adelanto y el saldo de
 * una primera consulta son dos pagos de la MISMA consulta y comparten número: si
 * se numerara por transacción, el saldo pasaría a ser la consulta 2 y se cobraría
 * 35% donde corresponde 40%.
 *
 * **Números ya asignados.** `numerosAsignados` trae las citas que ya recibieron
 * número en una liquidación anterior. Se respetan tal cual y el contador de esa
 * relación arranca por encima del mayor de ellos. Es lo que impide que un pago
 * rezagado renumere hacia atrás una liquidación ya cerrada: toma la siguiente
 * posición libre al momento de liquidarse.
 *
 * @param {Array<{id:string,date:Date|string,patientId:string,professionalId:string}>} appointments
 * @param {{numerosAsignados?: Map<string, number>}} [opciones]
 * @returns {Map<string, number>} id de cita → número de consulta
 */
export function buildConsultationNumberMap(appointments, { numerosAsignados } = {}) {
  const asignados = numerosAsignados instanceof Map ? numerosAsignados : new Map();

  const ordered = [...(appointments || [])].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.id).localeCompare(String(right.id));
  });

  const counters = new Map();
  const consultationNumbers = new Map();

  // Primera pasada: los números ya emitidos mandan, y fijan desde dónde sigue
  // cada relación. Se recorre todo antes de asignar uno nuevo, porque una cita
  // vieja sin liquidar no puede tomar un número que ya está en uso.
  for (const appointment of ordered) {
    if (!appointment?.id) throw new Error("Cita sin identificador.");
    const asignado = asignados.get(appointment.id);
    if (!Number.isInteger(asignado) || asignado < 1) continue;

    const key = consultationRelationshipKey(appointment.patientId, appointment.professionalId);
    consultationNumbers.set(appointment.id, asignado);
    counters.set(key, Math.max(counters.get(key) || 0, asignado));
  }

  for (const appointment of ordered) {
    if (consultationNumbers.has(appointment.id)) continue;

    const key = consultationRelationshipKey(appointment.patientId, appointment.professionalId);
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
