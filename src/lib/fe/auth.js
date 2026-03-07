// src/lib/fe/auth.js
// Gestión de tokens OAuth2 para la API de Hacienda CR.
// Cachea el token en memoria con un margen de 60s antes del vencimiento.

import { FE_API } from "./config.js";

const TOKEN_MARGIN_MS = 60_000; // renovar 60s antes de expirar

// Cache en global de Node para sobrevivir hot-reloads en dev
const g = globalThis;
if (!g._feTokenCache) g._feTokenCache = { accessToken: null, expiresAt: 0 };

/**
 * Obtiene (o reutiliza) un Bearer token de Hacienda.
 * @returns {Promise<string>} accessToken
 */
export async function getFeToken() {
  const cache = g._feTokenCache;
  if (cache.accessToken && Date.now() < cache.expiresAt - TOKEN_MARGIN_MS) {
    return cache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id:  FE_API.clientId,
    username:   FE_API.username,
    password:   FE_API.password,
  });

  const res = await fetch(FE_API.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[FE Auth] Error ${res.status} obteniendo token: ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("[FE Auth] Respuesta sin access_token");
  }

  const expiresIn = data.expires_in || 300; // segundos
  cache.accessToken = data.access_token;
  cache.expiresAt   = Date.now() + expiresIn * 1000;

  return cache.accessToken;
}

/** Invalida el cache forzando renovación en la próxima llamada. */
export function invalidateFeToken() {
  g._feTokenCache = { accessToken: null, expiresAt: 0 };
}
