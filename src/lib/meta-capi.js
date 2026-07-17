// Meta Conversions API (envío server-to-server de eventos).
//
// ─── PRIVACIDAD (servicio de salud mental) ────────────────────────────────────
// A Meta se envían ÚNICAMENTE:
//   • email y/o teléfono HASHEADOS con SHA-256 (nunca en claro),
//   • el nombre del evento (Lead / Schedule / Purchase),
//   • datos de campaña (UTMs) y, para Purchase, value + currency.
// NUNCA se envía dato clínico alguno: ni motivo de consulta, ni contenido de
// mensajes, ni diagnóstico, ni notas. Esto es deliberado y no debe cambiarse
// sin revisión: es información de salud sensible. `custom_data` se limita a
// UTMs y montos.
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";

const GRAPH_VERSION = "v21.0";

/** SHA-256 en hexadecimal (formato que exige Meta para datos de usuario). */
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Normaliza y hashea un email (lowercase + trim). Devuelve null si vacío. */
export function hashEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized ? sha256(normalized) : null;
}

/**
 * Normaliza un teléfono a dígitos E.164 (sin '+' ni símbolos) y lo hashea.
 * Si no trae código de país y son 8 dígitos, asume Costa Rica (506).
 */
export function hashPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 8) digits = `506${digits}`;
  return sha256(digits);
}

/** Arma el bloque user_data de Meta con solo lo hasheado + señales técnicas. */
function buildUserData(userData = {}) {
  const out = {};
  const em = hashEmail(userData.email);
  const ph = hashPhone(userData.phone);
  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  // Señales técnicas (no personales) que mejoran el emparejamiento; opcionales.
  if (userData.clientIpAddress) out.client_ip_address = userData.clientIpAddress;
  if (userData.clientUserAgent) out.client_user_agent = userData.clientUserAgent;
  if (userData.fbc) out.fbc = userData.fbc;
  if (userData.fbp) out.fbp = userData.fbp;
  return out;
}

/**
 * Envía un evento a la Conversions API de Meta.
 *
 * Resiliente por diseño: NUNCA lanza. Si faltan las env vars, sale con un
 * warning (no rompe en dev). El llamador debe invocarla fire-and-forget
 * (ej. `after(() => sendMetaEvent(...))`) para no bloquear la operación real.
 *
 * @param {object} opts
 * @param {string} opts.eventName            "Lead" | "Schedule" | "Purchase" | ...
 * @param {number} [opts.eventTime]          epoch en segundos (default: ahora)
 * @param {object} [opts.userData]           { email, phone, clientIpAddress, clientUserAgent, fbc, fbp }
 * @param {object} [opts.customData]         SOLO UTMs y, si aplica, { value, currency }
 * @param {string} [opts.eventId]            id único para deduplicar con el píxel cliente
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function sendMetaEvent({ eventName, eventTime, userData, customData, eventId } = {}) {
  // El pixel id no es secreto: reutiliza el del píxel cliente si no se define
  // uno server-side explícito, así no hay que duplicar el valor.
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.warn("[meta-capi] Falta META_PIXEL_ID o META_CAPI_ACCESS_TOKEN — evento omitido.");
    return { sent: false, reason: "missing_env" };
  }
  if (!eventName) {
    console.warn("[meta-capi] eventName requerido — evento omitido.");
    return { sent: false, reason: "missing_event_name" };
  }

  try {
    const event = {
      event_name: eventName,
      event_time: Number.isFinite(eventTime) ? eventTime : Math.floor(Date.now() / 1000),
      // Sin navegador del lado servidor: eventos generados por el sistema.
      action_source: "system_generated",
      user_data: buildUserData(userData),
      ...(eventId ? { event_id: eventId } : {}),
      ...(customData ? { custom_data: customData } : {}),
    };

    const payload = {
      data: [event],
      // Solo en testing: enruta el evento al Test Events de Events Manager.
      ...(process.env.META_TEST_EVENT_CODE
        ? { test_event_code: process.env.META_TEST_EVENT_CODE }
        : {}),
    };

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[meta-capi] Meta respondió ${res.status}: ${detail.slice(0, 300)}`);
      return { sent: false, reason: `http_${res.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("[meta-capi] Error enviando evento:", error);
    return { sent: false, reason: "exception" };
  }
}

/**
 * Filtra un objeto de atribución a SOLO los UTMs (custom_data seguro).
 * Garantiza que nunca se cuele texto libre / dato clínico en custom_data.
 */
export function utmCustomData(source = {}) {
  const out = {};
  for (const key of ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"]) {
    const value = source[key];
    if (value) out[key] = String(value).slice(0, 200);
  }
  return out;
}
