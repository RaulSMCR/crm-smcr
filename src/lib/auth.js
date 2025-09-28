// src/lib/auth.js
import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'sessionToken';
const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 días

function getSecretKey() {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    // Para entornos de dev, levantamos un error claro si falta
    throw new Error('JWT_SECRET no configurado o demasiado corto en .env');
  }
  return new TextEncoder().encode(raw);
}

/** Firma un JWT con exp por defecto de 7 días */
export async function signToken(payload, { ttlSeconds = DEFAULT_TTL } = {}) {
  const secret = getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

/** Verifica un JWT y devuelve el payload */
export async function verifyToken(token) {
  const secret = getSecretKey();
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return payload;
}

/** Setea la cookie de sesión */
export function setSessionCookie(res, token, { maxAge = DEFAULT_TTL } = {}) {
  // Importante: secure solo en producción; SameSite=Lax permite navegar el sitio completo
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

/** Borra la cookie de sesión */
export function clearSessionCookie(res) {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/** Helper para leer el token desde un Request (App Router) */
export function readSessionTokenFromRequest(request) {
  return request.cookies?.get(COOKIE_NAME)?.value || null;
}
