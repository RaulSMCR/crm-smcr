// src/lib/onvo/client.js
// ONVO Pay – cliente para la API REST y construcción de enlaces de pago.
// Documentación: https://docs.onvopay.com
//
// Los enlaces de pago de ONVO son productos preconfigurados en el dashboard.
// El administrador asocia el ID del enlace a cada profesional.
// La URL final tiene la forma: https://checkout.onvopay.com/pay/{linkId}

const ONVO_API_URL = process.env.ONVO_API_URL || "https://api.onvopay.com/v1";
const ONVO_CHECKOUT_BASE = "https://checkout.onvopay.com/pay";

/**
 * Construye la URL pública del enlace de pago a partir del ID generado por ONVO.
 * @param {string} linkId  – ID del enlace (ej. live_P35LcuWqpsttLAhsJj0Q2urFSzs)
 */
export function buildPaymentLinkUrl(linkId) {
  if (!linkId) throw new Error("ONVO: linkId es requerido.");
  return `${ONVO_CHECKOUT_BASE}/${linkId}`;
}

/**
 * Consulta los detalles de un enlace de pago en la API de ONVO.
 * Útil para verificar que el enlace existe y está activo antes de enviarlo.
 *
 * @param {string} linkId
 * @returns {Promise<object>} Objeto con los datos del enlace de pago.
 */
export async function getPaymentLink(linkId) {
  const secretKey = process.env.ONVO_SECRET_KEY;
  if (!secretKey) throw new Error("ONVO_SECRET_KEY no configurada.");
  if (!linkId) throw new Error("ONVO: linkId es requerido.");

  const response = await fetch(`${ONVO_API_URL}/payment-links/${linkId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `ONVO: error ${response.status} consultando enlace ${linkId}.`);
  }

  return response.json();
}
