import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "smcr_session";

/** Convierte JWT_SECRET en key válida para jose */
function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return new TextEncoder().encode(secret);
}

/** Obtiene el token de sesión desde cookies */
export function getSessionToken() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

/**
 * Requiere que el usuario sea ADMIN.
 * Lanza errores controlables:
 * - UNAUTHORIZED
 * - FORBIDDEN
 */
export async function requireAdmin() {
  const token = getSessionToken();
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const key = getJwtKey();

  let payload;
  try {
    const result = await jwtVerify(token, key);
    payload = result.payload;
  } catch (err) {
    throw new Error("UNAUTHORIZED");
  }

  if (payload?.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return payload;
}
