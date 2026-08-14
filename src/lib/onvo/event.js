// src/lib/onvo/event.js
// Traduce un evento de ONVO a la forma que necesita el webhook.
//
// La estructura está tomada de un evento REAL capturado el 2026-08-14
// (ver tests/unit/onvo-event.test.js, que usa el payload textual). La versión
// anterior de este mapeo se había escrito contra un contrato supuesto y no
// coincidía en un solo campo.
//
// Tres cosas que no son obvias y conviene no "corregir" sin leer esto:
//
//   1. El evento NO trae un `id` de nivel superior. La idempotencia se apoya en
//      el id del objeto de `data` combinado con el tipo de evento.
//   2. `data.status` vale "open" incluso en un pago cobrado: el estado del pago
//      está en `data.paymentStatus` ("paid"). Leer el campo equivocado deja la
//      transacción sin acreditar aunque el dinero haya entrado.
//   3. Los montos llegan en la unidad menor: 4800000 son ₡48.000.

/** Tipos de evento que representan un cobro efectivo. */
const TIPOS_COBRO = new Set([
  "checkout-session.succeeded",
  "payment-intent.succeeded",
]);

/** Tipos que representan un cobro fallido. */
const TIPOS_FALLO = new Set([
  "payment-intent.failed",
]);

/**
 * Normaliza un evento de ONVO.
 *
 * @param {object} payload - cuerpo del webhook, tal cual llega
 * @returns {{
 *   eventId: string|null, tipo: string|null, resultado: "aprobado"|"rechazado"|"pendiente",
 *   onvoLinkId: string|null, amount: number|null, currency: string|null,
 *   customerEmail: string|null, paidAt: Date, paymentMethod: string, paymentIntentId: string|null
 * }}
 */
export function normalizeOnvoEvent(payload) {
  const tipo = payload?.type ? String(payload.type) : null;
  const data = payload?.data || {};

  return {
    eventId: buildEventId(tipo, data),
    tipo,
    resultado: resolverResultado(tipo, data),
    onvoLinkId: data.paymentLinkId ?? null,
    paymentIntentId: data.paymentIntentId ?? null,
    amount: resolverMonto(data),
    currency: data.currency ?? null,
    customerEmail: data.customerEmail ?? data.customer?.email ?? null,
    paidAt: resolverFecha(data),
    paymentMethod: resolverMedioPago(data),
  };
}

/**
 * Identificador para idempotencia. ONVO no manda un id de evento, así que se
 * arma con el tipo y el id del objeto: el mismo objeto puede emitir varios
 * eventos distintos y cada uno debe procesarse una sola vez.
 */
function buildEventId(tipo, data) {
  const idObjeto = data?.id ?? data?.paymentIntentId ?? null;
  if (!idObjeto) return null;
  return tipo ? `${tipo}:${idObjeto}` : String(idObjeto);
}

/**
 * Si el cobro prosperó. Se mira primero `paymentStatus`, que es el campo que de
 * verdad refleja el pago; `status` describe la sesión de checkout y sigue en
 * "open" aunque ya se haya cobrado.
 */
function resolverResultado(tipo, data) {
  const estadoPago = String(data?.paymentStatus ?? "").toLowerCase();

  if (estadoPago === "paid") return "aprobado";
  if (estadoPago === "unpaid" || estadoPago === "failed") return "rechazado";

  if (tipo && TIPOS_COBRO.has(tipo)) return "aprobado";
  if (tipo && TIPOS_FALLO.has(tipo)) return "rechazado";

  return "pendiente";
}

/** Monto cobrado, en la unidad menor que usa ONVO. */
function resolverMonto(data) {
  for (const campo of ["amountTotal", "amount", "amountSubTotal"]) {
    const valor = Number(data?.[campo]);
    if (Number.isFinite(valor)) return valor;
  }
  return null;
}

/** Momento del cobro. El evento no trae un campo de "pagado en", así que se usa updatedAt. */
function resolverFecha(data) {
  const crudo = data?.updatedAt ?? data?.createdAt ?? null;
  if (!crudo) return new Date();
  const fecha = new Date(crudo);
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
}

/**
 * Medio de pago, para estimar la comisión de la pasarela. En el evento real
 * `paymentMethodTypes` llegó vacío, así que se cae a tarjeta, que es la tarifa
 * más alta: preferimos sobreestimar el costo antes que subestimarlo.
 */
function resolverMedioPago(data) {
  const tipos = Array.isArray(data?.paymentMethodTypes) ? data.paymentMethodTypes : [];
  const primero = tipos.find(Boolean);
  return primero ? String(primero).toLowerCase() : "card";
}
