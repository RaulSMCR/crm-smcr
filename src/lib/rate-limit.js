// src/lib/rate-limit.js
// Rate limiting contra PostgreSQL (SEC-01). No usa memoria del proceso porque en
// serverless cada invocación puede ser una instancia distinta; el estado vive en
// la tabla RateLimitEntry.
//
// Diseño:
//   • checkRateLimit(key, { max, windowMinutes, record })  → cuenta intentos de la
//     ventana; si count >= max devuelve { limited: true, retryAfterMinutes }.
//     Con record: true (por defecto) inserta un intento cuando NO está limitado.
//     Con record: false solo consulta (útil para login, que solo cuenta fallos).
//   • recordAttempt(key)  → inserta un intento (para registrar un fallo de login).
//
// Ambas funciones FALLAN ABIERTO: si la base falla, no bloquean el flujo (solo
// registran el error). Preferimos disponibilidad a un rate limit perfecto.

import { prisma } from "@/lib/prisma";

/**
 * Consulta (y opcionalmente registra) un intento para `key` dentro de la ventana.
 *
 * @param {string} key
 * @param {{ max: number, windowMinutes: number, record?: boolean }} opts
 * @returns {Promise<{ limited: boolean, retryAfterMinutes?: number }>}
 */
export async function checkRateLimit(key, { max, windowMinutes, record = true }) {
  try {
    const windowMs = windowMinutes * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);

    // Limpieza oportunista: borra entradas viejas de esta key en la misma llamada.
    await prisma.rateLimitEntry.deleteMany({
      where: { key, createdAt: { lt: windowStart } },
    });

    const count = await prisma.rateLimitEntry.count({
      where: { key, createdAt: { gte: windowStart } },
    });

    if (count >= max) {
      const oldest = await prisma.rateLimitEntry.findFirst({
        where: { key, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const retryAfterMinutes = oldest
        ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowMs - Date.now()) / 60000))
        : windowMinutes;
      return { limited: true, retryAfterMinutes };
    }

    if (record) {
      await prisma.rateLimitEntry.create({ data: { key } });
    }

    return { limited: false };
  } catch (err) {
    // Fail-open: nunca bloquear por una falla de la base.
    console.error("[rate-limit] fallo consultando límite, permitiendo (fail-open):", err);
    return { limited: false };
  }
}

/**
 * Registra un intento para `key` (p. ej. un login fallido). Fail-open.
 *
 * @param {string} key
 */
export async function recordAttempt(key) {
  try {
    await prisma.rateLimitEntry.create({ data: { key } });
  } catch (err) {
    console.error("[rate-limit] no se pudo registrar el intento (fail-open):", err);
  }
}
