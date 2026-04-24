// src/lib/onvo/webhook.js
// Verificación de firma para webhooks de ONVO Pay.
//
// ONVO utiliza HMAC-SHA256 para firmar las notificaciones.
// El secreto se obtiene del dashboard de ONVO (sección Webhooks).
// La firma viene en el header: onvo-signature: v1={hex_digest}
//
// Referencia: https://docs.onvopay.com/webhooks

import crypto from "crypto";

/**
 * Verifica la firma HMAC-SHA256 de un webhook de ONVO.
 *
 * @param {string} rawBody       – Cuerpo de la petición como string (antes de JSON.parse)
 * @param {string} signatureHeader – Valor del header "onvo-signature" (ej. "v1=abc123...")
 * @param {string} webhookSecret – Secreto de webhook configurado en ONVO
 * @returns {boolean}
 */
export function verifyOnvoWebhook(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret || !signatureHeader || !rawBody) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const provided = signatureHeader.replace(/^v1=/, "").trim();

  if (expected.length !== provided.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return false;
  }
}
