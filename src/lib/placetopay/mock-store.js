// src/lib/placetopay/mock-store.js
// Almacén en memoria para sesiones de pago simuladas.
// Usa global de Node.js para sobrevivir recargas HMR en desarrollo.
// Solo activo cuando PLACETOPAY_MOCK=true.

if (!global.__mockP2PSessions) {
  global.__mockP2PSessions = new Map();
}

/** @param {number|string} requestId @param {object} data */
export function setSession(requestId, data) {
  global.__mockP2PSessions.set(String(requestId), data);
}

/** @param {number|string} requestId @returns {object|null} */
export function getSession(requestId) {
  return global.__mockP2PSessions.get(String(requestId)) ?? null;
}

/** @param {number|string} requestId @param {object} patch @returns {boolean} */
export function updateSession(requestId, patch) {
  const existing = global.__mockP2PSessions.get(String(requestId));
  if (!existing) return false;
  global.__mockP2PSessions.set(String(requestId), { ...existing, ...patch });
  return true;
}

/** Lista todas las sesiones activas (útil para debugging) */
export function listSessions() {
  return Array.from(global.__mockP2PSessions.values());
}
