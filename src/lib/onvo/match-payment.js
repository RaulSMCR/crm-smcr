// src/lib/onvo/match-payment.js
// Emparejamiento de un evento de pago ONVO con la transacción correcta (PAY-01).
//
// Los enlaces de pago ONVO son estáticos y compartidos por asignación
// profesional-servicio, así que un mismo enlace puede tener varias transacciones
// activas (LINK_SENT) al mismo tiempo. Acreditar el evento a "la más reciente"
// puede cobrar la cita equivocada. Esta función empareja por monto, moneda y
// correo del pagador, y NUNCA adivina cuando hay ambigüedad.
//
// Función pura y testeable: no toca la base ni el entorno.

// ONVO documenta que amount llega en la unidad menor: para CRC, centésimos.
// El CRM guarda CRC en colones, por eso 4,550,000 de ONVO equivale a 45,500.
// La comparación es con tolerancia 0 (igualdad exacta).
//
// La unidad NO está confirmada contra un evento real: configurable por
// ONVO_AMOUNT_DIVISOR (usar 1 si los montos llegan en colones enteros). Si el
// divisor está mal, todo pago cae en AMOUNT_MISMATCH, así que el mismatch
// incluye un diagnóstico del divisor alternativo.
export const DEFAULT_ONVO_AMOUNT_DIVISOR = 100;

/** Divisor activo, leído del entorno en cada llamada (0 o inválido → default). */
export function getOnvoAmountDivisor() {
  const n = Number(process.env.ONVO_AMOUNT_DIVISOR);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ONVO_AMOUNT_DIVISOR;
}

/** El otro divisor plausible (1 ↔ 100), o null si el activo no es ninguno de los dos. */
function alternativeDivisor(divisor) {
  if (divisor === 100) return 1;
  if (divisor === 1) return 100;
  return null;
}

/** Normaliza el monto del evento a la misma unidad que `transaction.amount`. */
export function normalizeEventAmount(rawAmount, divisor = getOnvoAmountDivisor()) {
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) return null;
  return n / divisor;
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Empareja un evento ONVO con una de las transacciones activas del enlace.
 *
 * @param {Array<{ id: string, amount: number|string, currency?: string, patientEmail?: string|null }>} candidates
 *        Transacciones activas (PENDING/LINK_SENT) del enlace de pago.
 * @param {{ amount: number|string, currency?: string, customerEmail?: string|null }} event
 *        Datos del evento ONVO.
 * @returns {{ match: object } | { unmatchedReason: "NO_TRANSACTION"|"AMOUNT_MISMATCH"|"EMAIL_MISMATCH"|"MULTIPLE_CANDIDATES", unmatchedDetail?: string }}
 *          `unmatchedDetail` amplía el motivo cuando hay un diagnóstico que dar.
 */
export function matchTransaction(candidates, event) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 0) return { unmatchedReason: "NO_TRANSACTION" };

  const divisor = getOnvoAmountDivisor();
  const eventAmount = normalizeEventAmount(event?.amount, divisor);
  const eventCurrency = norm(event?.currency);
  const eventEmail = event?.customerEmail ? norm(event.customerEmail) : null;

  // 1. Monto (tolerancia 0) + moneda (si el evento la trae).
  const matchesAmount = (tx, amount) => {
    const txAmount = Number(tx.amount);
    if (amount === null || !Number.isFinite(txAmount)) return false;
    if (txAmount !== amount) return false;
    if (eventCurrency && norm(tx.currency) !== eventCurrency) return false;
    return true;
  };

  const byAmount = list.filter((tx) => matchesAmount(tx, eventAmount));

  if (byAmount.length === 0) {
    // Si el monto habría coincidido con el otro divisor, la unidad configurada
    // es casi seguro la equivocada: dilo en la alerta en vez de dejar al admin
    // conciliando pagos a mano. Solo diagnostica — nunca acredita con el
    // divisor "adivinado".
    const alt = alternativeDivisor(divisor);
    const altAmount = alt === null ? null : normalizeEventAmount(event?.amount, alt);
    const altMatches = altAmount !== null && list.some((tx) => matchesAmount(tx, altAmount));
    return {
      unmatchedReason: "AMOUNT_MISMATCH",
      ...(altMatches && {
        unmatchedDetail: `AMOUNT_MISMATCH (posible unidad incorrecta: con divisor ${alt} sí coincide — revisar ONVO_AMOUNT_DIVISOR)`,
      }),
    };
  }

  // 2. Correo del pagador (solo si el evento lo trae).
  let filtered = byAmount;
  if (eventEmail) {
    const byEmail = byAmount.filter((tx) => norm(tx.patientEmail) === eventEmail);
    if (byEmail.length === 0) return { unmatchedReason: "EMAIL_MISMATCH" };
    filtered = byEmail;
  }

  // 3. Resolución.
  if (filtered.length === 1) return { match: filtered[0] };
  return { unmatchedReason: "MULTIPLE_CANDIDATES" };
}
