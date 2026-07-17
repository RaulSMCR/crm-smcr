"use client";

// Identificadores de atribución publicitaria para la conversión GA4 del adelanto.
//
//  - client_id de GA4: vive en la cookie `_ga` (formato GA1.1.<clientId>), pero
//    esa cookie solo existe si el visitante aceptó analytics. Sin consentimiento
//    generamos un client_id SINTÉTICO y estable por navegador, para que la
//    conversión y el valor entren igual a GA4 (decisión del negocio).
//  - gclid: parámetro de URL que Google Ads agrega al clic. Se captura al
//    aterrizar (puede venir días antes del pago) y se persiste.

const SYNTH_KEY = "smcr-ga-client-id";
const GCLID_KEY = "smcr-gclid";

/**
 * Parser puro (testeable): extrae el client_id del contenido de document.cookie.
 * `_ga=GA1.1.1234567890.1234567890` → `"1234567890.1234567890"`.
 */
export function parseGaClientId(cookieString) {
  if (typeof cookieString !== "string") return "";
  const match = cookieString.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
  return match ? match[1] : "";
}

/** Genera un client_id con el formato de GA4 (dos enteros separados por punto). */
export function makeSyntheticClientId() {
  return `${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 1e10)}`;
}

function readSyntheticClientId() {
  try {
    let value = window.localStorage.getItem(SYNTH_KEY);
    if (!value) {
      value = makeSyntheticClientId();
      window.localStorage.setItem(SYNTH_KEY, value);
    }
    return value;
  } catch {
    return makeSyntheticClientId();
  }
}

/** client_id real de GA4 si existe; si no, uno sintético estable por navegador. */
export function readGaClientId() {
  if (typeof document === "undefined") return "";
  return parseGaClientId(document.cookie) || readSyntheticClientId();
}

function cleanGclid(value) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

/**
 * Captura de aterrizaje: si la URL trae `gclid`, lo persiste (primer toque, no
 * lo sobreescribe). Se llama en cada carga desde MarketingAttributionCapture.
 */
export function captureAdIdentifiers() {
  if (typeof window === "undefined") return;
  try {
    const fromUrl = cleanGclid(new URLSearchParams(window.location.search).get("gclid"));
    if (fromUrl && !window.localStorage.getItem(GCLID_KEY)) {
      window.localStorage.setItem(GCLID_KEY, fromUrl);
    }
  } catch {
    // La atribución es best-effort; nunca debe romper la navegación.
  }
}

/** gclid de la URL actual o el persistido al aterrizar. "" si no hay. */
export function readGclid() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = cleanGclid(new URLSearchParams(window.location.search).get("gclid"));
    if (fromUrl) return fromUrl;
    return window.localStorage.getItem(GCLID_KEY) || "";
  } catch {
    return "";
  }
}
