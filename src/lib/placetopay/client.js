// src/lib/placetopay/client.js
import { getAuth } from "./auth.js";

const BASE_URL = process.env.PLACETOPAY_BASE_URL || "https://checkout-qa.placetopay.dev";
const APP_URL  = process.env.APP_URL || "http://localhost:3000";

/**
 * Crea una sesión de pago en PlacetoPay.
 *
 * @param {object} params
 * @param {string}  params.reference   - Referencia interna única (max 32 chars)
 * @param {string}  params.description - Descripción del pago
 * @param {number}  params.amount      - Monto en la moneda indicada
 * @param {string}  [params.currency]  - Moneda (default "CRC")
 * @param {string}  params.returnUrl   - URL de retorno al finalizar
 * @param {string}  [params.notifyUrl] - URL de notificación webhook
 * @param {string}  [params.ipAddress] - IP del cliente
 * @param {string}  [params.userAgent] - User-agent del cliente
 * @returns {Promise<{ requestId: number, processUrl: string }>}
 */
export async function createSession({
  reference,
  description,
  amount,
  currency = "CRC",
  returnUrl,
  notifyUrl,
  ipAddress = "127.0.0.1",
  userAgent = "Mozilla/5.0",
}) {
  const auth = getAuth();

  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // +30 min

  const body = {
    auth,
    payment: {
      reference,
      description,
      amount: {
        currency,
        total: amount,
      },
    },
    returnUrl: returnUrl || `${APP_URL}/panel/paciente/pago/resultado?ref=${reference}`,
    notifyUrl: notifyUrl || `${APP_URL}/api/payment/webhook`,
    ipAddress,
    userAgent,
    expiration,
  };

  const response = await fetch(`${BASE_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || data.status?.status === "FAILED") {
    console.error("[PlacetoPay] Error creando sesión:", data);
    throw new Error(data.status?.message || "Error creando sesión de pago en PlacetoPay.");
  }

  return {
    requestId: data.requestId,
    processUrl: data.processUrl,
  };
}

/**
 * Consulta el estado de una sesión de pago por su requestId.
 *
 * @param {number|string} requestId - ID de la sesión P2P
 * @returns {Promise<{ status: string, reason: string, message: string, payment: Array }>}
 */
export async function querySession(requestId) {
  const auth = getAuth();

  const response = await fetch(`${BASE_URL}/api/session/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[PlacetoPay] Error consultando sesión:", data);
    throw new Error(data.status?.message || "Error consultando estado de pago.");
  }

  return {
    status: data.status?.status,
    reason: data.status?.reason,
    message: data.status?.message,
    date: data.status?.date,
    payment: data.payment || [],
  };
}
