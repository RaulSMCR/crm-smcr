// src/lib/placetopay/webhook.js
import crypto from "node:crypto";

/**
 * Verifica la firma de una notificación webhook enviada por PlacetoPay.
 *
 * Formula P2P: SHA1( requestId + status + date + secretKey ) → hex
 *
 * @param {object} params
 * @param {number|string} params.requestId  - requestId del payload
 * @param {string}        params.status     - status.status del payload (ej: "APPROVED")
 * @param {string}        params.date       - status.date del payload (ISO 8601)
 * @param {string}        params.signature  - firma recibida en el payload
 * @param {string}        params.secretKey  - PLACETOPAY_SECRET_KEY
 * @returns {boolean}
 */
export function verifyWebhookSignature({ requestId, status, date, signature, secretKey }) {
  if (!requestId || !status || !date || !signature || !secretKey) {
    return false;
  }

  const expected = crypto
    .createHash("sha1")
    .update(`${requestId}${status}${date}${secretKey}`)
    .digest("hex");

  // Comparación en tiempo constante para prevenir timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}
