// src/lib/placetopay/auth.js
import crypto from "node:crypto";

/**
 * Genera el objeto auth requerido por la API de PlacetoPay.
 *
 * Formula tranKey:
 *   Base64( SHA-256( nonce_raw + seed + secretKey ) )
 *
 * @param {string} login     - Merchant login (PLACETOPAY_LOGIN)
 * @param {string} secretKey - Secret key (PLACETOPAY_SECRET_KEY)
 * @returns {{ login, nonce, seed, tranKey }}
 */
export function generateAuth(login, secretKey) {
  if (!login || !secretKey) {
    throw new Error("[PlacetoPay] login y secretKey son requeridos para generar auth.");
  }

  // Nonce: bytes aleatorios → Base64
  const nonceRaw = crypto.randomBytes(16).toString("hex");
  const nonce = Buffer.from(nonceRaw).toString("base64");

  // Seed: timestamp ISO 8601 actual
  const seed = new Date().toISOString();

  // tranKey = Base64( SHA-256( nonceRaw + seed + secretKey ) )
  const tranKey = crypto
    .createHash("sha256")
    .update(nonceRaw + seed + secretKey)
    .digest("base64");

  return { login, nonce, seed, tranKey };
}

/**
 * Devuelve el objeto auth listo para incluir en el body de cualquier request P2P,
 * leyendo las variables de entorno configuradas.
 */
export function getAuth() {
  const login = process.env.PLACETOPAY_LOGIN;
  const secretKey = process.env.PLACETOPAY_SECRET_KEY;

  if (!login || !secretKey) {
    throw new Error(
      "[PlacetoPay] Variables de entorno PLACETOPAY_LOGIN y/o PLACETOPAY_SECRET_KEY no configuradas."
    );
  }

  return generateAuth(login, secretKey);
}
