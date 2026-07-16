"use client";

const STORAGE_KEY = "smcr-marketing-attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

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

  const current = fromSearchParams(new URLSearchParams(window.location.search));
  if (current) {
    writeStoredAttribution(current);
    return;
  }

  if (readStoredAttribution()) return;

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
 * Mismo orden de resolución que getMarketingAttributionFields:
 * URL actual → localStorage → referrer externo. Campos vacíos = "".
 */
export function getMarketingAttributionRaw() {
  if (typeof window === "undefined") return toRawFields(null);

  captureMarketingAttribution();

  const current = fromSearchParams(new URLSearchParams(window.location.search));
  if (current) return toRawFields(current);

  const stored = readStoredAttribution();
  if (stored) return toRawFields(stored);

  return toRawFields(null);
}

export function getMarketingAttributionFields(defaults = {}) {
  if (typeof window === "undefined") {
    return toFormFields(null, defaults);
  }

  captureMarketingAttribution();

  const current = fromSearchParams(new URLSearchParams(window.location.search));
  if (current) {
    return toFormFields(current, defaults);
  }

  const stored = readStoredAttribution();
  if (stored) return toFormFields(stored, defaults);

  const referrer = getExternalReferrer();
  if (referrer) {
    const attribution = {
      referrer,
      capturedAt: new Date().toISOString(),
      landingPath: `${window.location.pathname}${window.location.search}`,
    };
    writeStoredAttribution(attribution);
    return toFormFields(attribution, defaults);
  }

  return toFormFields(null, defaults);
}
