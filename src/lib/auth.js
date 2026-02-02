// src/lib/auth.js
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers"; // <--- IMPORTANTE: Faltaba esto

// Clave secreta
const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || "default-secret-key-change-it"
);

// 1. Firmar Token (Crear sesión)
export async function signToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // La sesión dura 7 días (ajustado a lo estándar)
    .sign(secretKey);
}

// 2. Verificar Token (Leer sesión)
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    // Si el token es inválido, lanzamos error o retornamos null (manejado en getSession)
    throw new Error("Token inválido o expirado");
  }
}

// 3. OBTENER SESIÓN (La función que faltaba) 
export async function getSession() {
  const cookieStore = cookies();
  // Buscamos la cookie llamada "session" (para coincidir con auth-actions.js)
  const token = cookieStore.get("session")?.value; 

  if (!token) return null;

  try {
    // Reutilizamos verifyToken pero capturamos el error para no romper la página
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (err) {
    return null;
  }
}

// 4. Helpers opcionales (Si los usas en API routes)
export function setSessionCookie(response, token) {
  response.cookies.set({
    name: "session", // <--- CORREGIDO: "session" para consistencia
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
}

export function removeSessionCookie(response) {
  response.cookies.set({
    name: "session", // <--- CORREGIDO
    value: "",
    path: "/",
    maxAge: 0,
  });
}