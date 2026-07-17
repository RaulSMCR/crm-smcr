// Envío server-to-server de un evento de conversión a GA4 vía Measurement
// Protocol (sin costo). Se usa cuando la confirmación ocurre en el servidor
// (webhook de ONVO / conciliación manual), donde un gtag() de navegador no sirve.
//
// GA4 responde 204 sin cuerpo en éxito. El api_secret NUNCA se expone al cliente
// (por eso GA4_API_SECRET, sin prefijo NEXT_PUBLIC_).

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";

/**
 * @param {object} opts
 * @param {string} opts.clientId       client_id de GA4 (real o sintético). Requerido.
 * @param {string} [opts.gclid]        gclid del anuncio, si existe.
 * @param {string} opts.transactionId  ID único para deduplicar en GA4 (= PaymentTransaction.id).
 * @param {number} opts.value          Monto de la conversión.
 * @param {string} [opts.currency]     Moneda ISO (default CRC).
 * @param {string} [opts.eventName]    Nombre del evento GA4 (default "deposit_paid").
 * @returns {Promise<boolean>} true si GA4 aceptó el evento.
 */
export async function sendServerConversionEvent({
  clientId,
  gclid,
  transactionId,
  value,
  currency = "CRC",
  eventName = "deposit_paid",
}) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    // Dev-safe: sin credenciales no se rompe nada, solo se omite el envío.
    console.warn("[ga4-mp] Falta NEXT_PUBLIC_GA_MEASUREMENT_ID o GA4_API_SECRET — evento omitido.");
    return false;
  }

  if (!clientId) {
    console.warn("[ga4-mp] Sin client_id — evento no enviado.");
    return false;
  }

  const numericValue = Number(value);
  const body = {
    client_id: String(clientId),
    non_personalized_ads: false,
    events: [
      {
        name: eventName,
        params: {
          transaction_id: String(transactionId), // dedup en GA4
          value: Number.isFinite(numericValue) ? numericValue : 0,
          currency,
          ...(gclid ? { gclid: String(gclid) } : {}),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      console.error(`[ga4-mp] GA4 respondió ${res.status} para transacción ${transactionId}.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[ga4-mp] Error enviando evento:", error);
    return false;
  }
}
