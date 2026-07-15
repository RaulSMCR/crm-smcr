// src/lib/turnstile.js
// Verificación server-side de Cloudflare Turnstile (SEC-01), reutilizando el
// patrón ya usado en src/app/api/contact-faq/route.js.
//
// Si TURNSTILE_SECRET_KEY no está configurada, la verificación se OMITE con un
// console.warn (para no romper el desarrollo local). En producción la variable
// debe estar presente para que el captcha tenga efecto.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifica un token de Turnstile contra Cloudflare.
 *
 * @param {string} token  Token generado por el widget en el cliente.
 * @param {string} [ip]   IP del cliente (opcional, mejora la verificación).
 * @returns {Promise<boolean>} true si es válido (o si el check se omite por falta de secret).
 */
export async function verifyTurnstile(token, ip = "") {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY no configurada — verificación omitida.");
    return true;
  }

  const captchaToken = String(token || "").trim();
  if (!captchaToken) return false;

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: captchaToken,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await res.json().catch(() => ({ success: false }));
    if (!data.success) {
      console.warn("[turnstile] verificación rechazada:", data["error-codes"]);
    }
    return !!data.success;
  } catch (err) {
    console.error("[turnstile] error verificando token:", err);
    return false;
  }
}
