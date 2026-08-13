// src/lib/onvo/webhook.js
// Verificación de origen para webhooks de ONVO Pay.
//
// ONVO **no firma** las notificaciones con HMAC. Manda el secreto tal cual en el
// header `X-Webhook-Secret`, y el receptor lo compara contra el valor guardado:
//
//   X-Webhook-Secret: webhook_secret_...
//
// Referencia: https://docs.onvopay.com/en/webhooks
//
// La implementación anterior calculaba un HMAC-SHA256 sobre el cuerpo y leía un
// header `onvo-signature` que ONVO nunca envía: rechazaba el 100% de los eventos
// reales, así que ningún pago llegaba a acreditarse.

import crypto from "crypto";

/**
 * Verifica que el webhook venga de ONVO comparando el secreto compartido.
 * Comparación en tiempo constante para no filtrar el secreto por temporización.
 *
 * @param {string} headerValue   – Valor del header "x-webhook-secret"
 * @param {string} webhookSecret – Secreto configurado en el dashboard de ONVO
 * @returns {boolean}
 */
export function verifyOnvoWebhookSecret(headerValue, webhookSecret) {
  if (!webhookSecret || !headerValue) return false;

  const a = Buffer.from(String(headerValue).trim(), "utf8");
  const b = Buffer.from(String(webhookSecret).trim(), "utf8");
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
