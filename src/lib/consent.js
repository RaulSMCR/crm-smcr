// src/lib/consent.js
// Estado de consentimiento de cookies (LEG-01), 100% propio (sin CMP externo).
// La decisión se guarda en la cookie `consent` (granted | denied, 12 meses) y en
// localStorage. Los componentes cliente escuchan `onConsentChange` para reaccionar
// sin recargar la página.

export const CONSENT_COOKIE = "consent";
const CONSENT_EVENT = "smcr:consentchange";
const TWELVE_MONTHS_SECONDS = 60 * 60 * 24 * 365; // ~12 meses

/**
 * Lee la decisión actual: "granted" | "denied" | null (sin decidir).
 */
export function getConsent() {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(/(?:^|;\s*)consent=(granted|denied)/);
  if (match) return match[1];

  try {
    const ls = window.localStorage.getItem(CONSENT_COOKIE);
    if (ls === "granted" || ls === "denied") return ls;
  } catch {
    /* localStorage no disponible */
  }
  return null;
}

/**
 * Guarda la decisión en cookie + localStorage y notifica a los escuchas.
 * @param {"granted" | "denied"} value
 */
export function setConsent(value) {
  if (value !== "granted" && value !== "denied") return;
  if (typeof document === "undefined") return;

  const secure = window.location?.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${TWELVE_MONTHS_SECONDS}; samesite=lax${secure}`;

  try {
    window.localStorage.setItem(CONSENT_COOKIE, value);
  } catch {
    /* localStorage no disponible */
  }

  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/**
 * Suscribe a cambios de consentimiento. Devuelve una función para desuscribir.
 * @param {(value: "granted" | "denied") => void} callback
 */
export function onConsentChange(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => callback(e.detail);
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}
