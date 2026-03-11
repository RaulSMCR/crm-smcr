// src/lib/placetopay/client.js
import { getAuth } from "./auth.js";
import { setSession, getSession } from "./mock-store.js";

const BASE_URL = process.env.PLACETOPAY_BASE_URL || "https://checkout-qa.placetopay.dev";
const APP_URL  = process.env.APP_URL || "http://localhost:3000";
const IS_MOCK  = process.env.PLACETOPAY_MOCK === "true";

// Genera un requestId mock dentro del rango Int32 de PostgreSQL (max ~2.1 billion).
// Date.now() * 1000 desborda Int32 — en cambio usamos (segundos % 1_000_000) * 1000 + random(0-999)
// Resultado: 0 – ~1_000_000_000, siempre dentro de Int32.
function nextMockRequestId() {
  return (Math.floor(Date.now() / 1000) % 1_000_000) * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Crea una sesión de pago.
 * En modo mock retorna una URL local de checkout simulado.
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
  if (IS_MOCK) {
    const requestId = nextMockRequestId();
    const resolvedReturnUrl = returnUrl || `${APP_URL}/panel/paciente/pago/resultado?ref=${reference}`;
    const resolvedNotifyUrl = notifyUrl || `${APP_URL}/api/payment/webhook`;

    setSession(requestId, {
      requestId,
      reference,
      description,
      amount,
      currency,
      returnUrl: resolvedReturnUrl,
      notifyUrl: resolvedNotifyUrl,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });

    console.log(`[PlacetoPay MOCK] Sesión creada: requestId=${requestId}, ref=${reference}, amount=${amount}`);

    return {
      requestId,
      processUrl: `${APP_URL}/panel/mock/checkout/${requestId}`,
    };
  }

  // ── Modo real ─────────────────────────────────────────────────────────────
  const auth = getAuth();
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    auth,
    payment: {
      reference,
      description,
      amount: { currency, total: amount },
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
 */
export async function querySession(requestId) {
  if (IS_MOCK) {
    const session = getSession(requestId);
    if (!session) throw new Error(`[PlacetoPay MOCK] Sesión ${requestId} no encontrada.`);

    return {
      status: session.status || "PENDING",
      reason: session.reason || null,
      message: session.message || null,
      date: session.date || null,
      payment: [],
    };
  }

  // ── Modo real ─────────────────────────────────────────────────────────────
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
