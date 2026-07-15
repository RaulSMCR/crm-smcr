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
export const ONVO_AMOUNT_DIVISOR = 100;

/** Normaliza el monto del evento a la misma unidad que `transaction.amount`. */
export function normalizeEventAmount(rawAmount) {
  const n = Number(rawAmount);
  if (!Number.isFinite(n)) return null;
  return n / ONVO_AMOUNT_DIVISOR;
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
 * @returns {{ match: object } | { unmatchedReason: "NO_TRANSACTION"|"AMOUNT_MISMATCH"|"EMAIL_MISMATCH"|"MULTIPLE_CANDIDATES" }}
 */
export function matchTransaction(candidates, event) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 0) return { unmatchedReason: "NO_TRANSACTION" };

  const eventAmount = normalizeEventAmount(event?.amount);
  const eventCurrency = norm(event?.currency);
  const eventEmail = event?.customerEmail ? norm(event.customerEmail) : null;

  // 1. Monto (tolerancia 0) + moneda (si el evento la trae).
  const byAmount = list.filter((tx) => {
    const txAmount = Number(tx.amount);
    if (eventAmount === null || !Number.isFinite(txAmount)) return false;
    if (txAmount !== eventAmount) return false;
    if (eventCurrency && norm(tx.currency) !== eventCurrency) return false;
    return true;
  });

  if (byAmount.length === 0) return { unmatchedReason: "AMOUNT_MISMATCH" };

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
