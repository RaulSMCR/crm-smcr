// src/lib/onvo/client.js
// ONVO Pay – cliente para la API REST y construcción de enlaces de pago.
// Documentación: https://docs.onvopay.com
//
// Los enlaces de pago de ONVO son productos preconfigurados en el dashboard.
// El administrador asocia el ID del enlace a cada profesional.
// La URL final tiene la forma: https://buy.onvopay.com/{linkId}

import { assertAmbientesCoherentes } from "@/lib/fiscal-environment";

const ONVO_API_URL = process.env.ONVO_API_URL || "https://api.onvopay.com/v1";

// Base real de los enlaces de pago, tomada del campo `url` que devuelve
// POST /v1/payment-links (verificado contra la API el 2026-08-12):
//   { "id": "test_amhNGWev...", "url": "https://buy.onvopay.com/test_amhNGWev..." }
//
// OJO: `checkout.onvopay.com/pay/{id}` NO recibe el ID del enlace, sino el de una
// sesión de checkout que ONVO crea al redirigir desde buy.onvopay.com. Apuntar ahí
// con un ID de enlace devuelve 200 con una página de error, no un cobro.
const ONVO_CHECKOUT_BASE = "https://buy.onvopay.com";

/**
 * Construye la URL pública del enlace de pago a partir del ID generado por ONVO.
 * @param {string} linkId  – ID del enlace (ej. test_amhNGWevAahXl42GYZ-z3LOKCDU)
 */
export function buildPaymentLinkUrl(linkId) {
  if (!linkId) throw new Error("ONVO: linkId es requerido.");
  return `${ONVO_CHECKOUT_BASE}/${linkId}`;
}

/**
 * Crea un enlace de pago por el monto exacto de una cita.
 *
 * ONVO admite un precio ad-hoc vía `priceData`, así que no hace falta tener un
 * producto precargado por profesional: cada cita genera su propio enlace con el
 * precio que el paciente aceptó al agendar. Como el enlace es único por cobro,
 * su `id` sirve además de llave para conciliar el webhook con la transacción.
 *
 * @param {object}  params
 * @param {number}  params.amount      – Monto en la moneda mayor (colones, no céntimos)
 * @param {string}  params.description – Rótulo visible en el checkout
 * @param {string} [params.currency]   – CRC (default) o USD
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function createPaymentLink({ amount, description, currency = "CRC" }) {
  const secretKey = process.env.ONVO_SECRET_KEY;
  if (!secretKey) throw new Error("ONVO_SECRET_KEY no configurada.");

  // Cobrar en un ambiente y facturar en otro deja al paciente pagando sin
  // comprobante valido, o emite comprobantes por cobros inexistentes.
  assertAmbientesCoherentes({ onvoKey: secretKey });

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("ONVO: el monto del enlace debe ser mayor que cero.");
  }

  // ONVO recibe el monto en la unidad menor: ₡40.000 viaja como 4000000.
  const unitAmount = Math.round(value * 100);

  const response = await fetch(`${ONVO_API_URL}/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lineItems: [
        {
          quantity: 1,
          priceData: {
            type: "one_time",
            currency,
            unitAmount,
            productData: { name: String(description || "Consulta").slice(0, 120) },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detail = Array.isArray(err?.message) ? err.message.join("; ") : err?.message;
    throw new Error(detail || `ONVO: error ${response.status} creando el enlace de pago.`);
  }

  const link = await response.json();
  if (!link?.id) throw new Error("ONVO: la respuesta no trae el ID del enlace.");

  // Se prefiere la URL que devuelve ONVO sobre construirla nosotros: si algún día
  // cambian el dominio, el enlace sigue siendo el correcto.
  return { id: link.id, url: link.url || buildPaymentLinkUrl(link.id) };
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
