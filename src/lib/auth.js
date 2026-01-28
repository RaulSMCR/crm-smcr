// src/lib/auth.js
import { SignJWT, jwtVerify } from "jose";

// Clave secreta (usa una variable de entorno en prod, o un fallback para dev)
const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-it"
);

// 1. Firmar Token (Crear sesión)
export async function signToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // La sesión dura 24 horas
    .sign(secretKey);
}

// 2. Verificar Token (Leer sesión)
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    throw new Error("Token inválido o expirado");
  }
}

// 3. Guardar Cookie en la Respuesta (Para el Login)
export function setSessionCookie(response, token) {
  response.cookies.set({
    name: "sessionToken", // <--- Nombre estandarizado
    value: token,
    httpOnly: true,       // JavaScript no puede leerla (seguridad)
    secure: process.env.NODE_ENV === "production", // Solo HTTPS en producción
    sameSite: "lax",      // Permite navegación normal
    path: "/",            // Disponible en toda la app
    maxAge: 60 * 60 * 24, // 1 día en segundos
  });
}

// 4. Borrar Cookie (Para Logout)
export function removeSessionCookie(response) {
  response.cookies.set({
    name: "sessionToken",
    value: "",
    path: "/",
    maxAge: 0,
  });
}