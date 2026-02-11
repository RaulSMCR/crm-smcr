// src/lib/auth.js
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Reglas:
 * - SESSION_SECRET debe existir en producción (sin fallback inseguro)
 * - JWT payload mínimo (whitelist) para no filtrar datos
 * - Cookie httpOnly + secure en prod + sameSite=lax
 */

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;

  // En producción: obligatorio
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error(
      "Missing or weak SESSION_SECRET. Set a strong value (>= 32 chars) in env."
    );
  }

  // En dev: permitimos fallback pero lo advertimos (sin romper el entorno)
  const effectiveSecret =
    secret && secret.length >= 16 ? secret : "dev-only-insecure-secret";

  return new TextEncoder().encode(effectiveSecret);
}

// Payload mínimo permitido (evita meter hashes/tokens por accidente)
function sanitizeSessionPayload(payload) {
  if (!payload || typeof payload !== "object") return {};

  const out = {};
  // Preferimos estándares JWT: sub
  if (payload.sub) out.sub = String(payload.sub);

  // Campos típicos del CRM
  if (payload.userId) out.userId = String(payload.userId);
  if (payload.role) out.role = String(payload.role);
  if (payload.email) out.email = String(payload.email);
  if (payload.name) out.name = String(payload.name);

  // Si decides incluirlo (opcional)
  if (payload.professionalProfileId) out.professionalProfileId = String(payload.professionalProfileId);

  return out;
}

// 1) Firmar Token (Crear sesión)
export async function signToken(payload) {
  const secretKey = getSecretKey();
  const safe = sanitizeSessionPayload(payload);

  return await new SignJWT(safe)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

// 2) Verificar Token (Leer sesión)
export async function verifyToken(token) {
  const secretKey = getSecretKey();
  const { payload } = await jwtVerify(token, secretKey);
  return payload;
}

// 3) Obtener sesión desde cookie "session"
export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

// 4) Cookies helpers (para API routes)
export function setSessionCookie(response, token) {
  response.cookies.set({
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    // priority no está tipado en algunos entornos, pero Next lo pasa ok:
    // @ts-ignore
    priority: "high",
  });
}

export function removeSessionCookie(response) {
  // Importante: borrar con el mismo path (y si luego agregas domain, también)
  response.cookies.set({
    name: "session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    // @ts-ignore
    priority: "high",
  });
}
