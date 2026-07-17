"use client";

const STORAGE_KEY = "smcr-marketing-attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
// Ventana de atribución first-touch: pasados 30 días, se permite re-capturar
// (equivale a la expiración de la cookie de 30 días descrita en el requisito).
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function clean(value, max = 160) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function readStoredAttribution() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredAttribution(attribution) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Helpful for attribution, but the registration flow must keep working.
  }
}

/** ¿La atribución guardada sigue vigente (capturada hace menos de 30 días)? */
function isFresh(attribution) {
  const ts = Date.parse(attribution?.capturedAt || "");
  return Number.isFinite(ts) && Date.now() - ts < MAX_AGE_MS;
}

/**
 * Devuelve la atribución de PRIMER toque si sigue vigente; si no, null (lo que
 * habilita una nueva captura). Es la única fuente de verdad para first-touch.
 */
function storedFirstTouch() {
  const stored = readStoredAttribution();
  return isFresh(stored) ? stored : null;
}

function getExternalReferrer() {
  if (!document.referrer) return "";
  try {
    const referrer = new URL(document.referrer);
    if (referrer.hostname === window.location.hostname) return "";
    return referrer.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function fromSearchParams(searchParams) {
  const data = {};
  let hasUtm = false;

  for (const key of UTM_KEYS) {
    const value = clean(searchParams.get(key));
    if (value) {
      data[key] = value;
      hasUtm = true;
    }
  }

  if (!hasUtm) return null;

  return {
    ...data,
    referrer: getExternalReferrer(),
    capturedAt: new Date().toISOString(),
    landingPath: `${window.location.pathname}${window.location.search}`,
  };
}

function toFormFields(attribution, defaults = {}) {
  const source = clean(attribution?.utm_source, 80);
  const medium = clean(attribution?.utm_medium, 80);
  const campaign = clean(attribution?.utm_campaign, 160);
  const referrer = clean(attribution?.referrer, 120);

  let acquisitionChannel = clean(defaults.acquisitionChannel || "Directo", 120);
  if (source && medium) acquisitionChannel = `${source} / ${medium}`.slice(0, 120);
  else if (source) acquisitionChannel = source;
  else if (referrer) acquisitionChannel = `Referido: ${referrer}`.slice(0, 120);

  return {
    acquisitionChannel,
    campaignName: campaign || clean(defaults.campaignName || "", 160),
  };
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined") return;

  // First-touch: si ya hay atribución vigente, NO sobrescribir.
  if (storedFirstTouch()) return;

  // Prioridad de captura: UTMs de la URL > referrer externo.
  const current = fromSearchParams(new URLSearchParams(window.location.search));
  if (current) {
    writeStoredAttribution(current);
    return;
  }

  const referrer = getExternalReferrer();
  if (!referrer) return;

  writeStoredAttribution({
    referrer,
    capturedAt: new Date().toISOString(),
    landingPath: `${window.location.pathname}${window.location.search}`,
  });
}

function toRawFields(attribution) {
  return {
    utmSource: clean(attribution?.utm_source, 120),
    utmMedium: clean(attribution?.utm_medium, 120),
    utmCampaign: clean(attribution?.utm_campaign, 160),
    utmTerm: clean(attribution?.utm_term, 160),
    utmContent: clean(attribution?.utm_content, 160),
    referrer: clean(attribution?.referrer, 200),
    landingPath: clean(attribution?.landingPath, 500),
  };
}

/**
 * Atribución completa sin colapsar (los 5 UTMs + referrer + landingPath).
 * First-touch: primero asegura la captura, luego devuelve el PRIMER toque
 * guardado (no la URL actual). Campos vacíos = "".
 */
export function getMarketingAttributionRaw() {
  if (typeof window === "undefined") return toRawFields(null);

  captureMarketingAttribution();
  return toRawFields(storedFirstTouch());
}

export function getMarketingAttributionFields(defaults = {}) {
  if (typeof window === "undefined") {
    return toFormFields(null, defaults);
  }

  captureMarketingAttribution();
  return toFormFields(storedFirstTouch(), defaults);
}
