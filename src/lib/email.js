// src/lib/email.js
import { Resend } from "resend";

/**
 * En Vercel define:
 * - RESEND_API_KEY
 * - EMAIL_FROM (ej: "SMCR <no-reply@saludmentalcostarica.com>")
 * - EMAIL_REPLY_TO (opcional)
 * - APP_URL (ej: "https://saludmentalcostarica.com")
 */

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getResend() {
  const key = requireEnv("RESEND_API_KEY");
  return new Resend(key);
}

export function getAppUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendEmail({ to, subject, html, text }) {
  const resend = getResend();
  const from = requireEnv("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO;

  const payload = {
    from,
    to,
    subject,
    html: html || undefined,
    text: text || undefined,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    // Esto ayuda mucho en logs de Vercel
    throw new Error(`Resend send failed: ${JSON.stringify(error)}`);
  }
  return data;
}

/** Email: verificar cuenta */
export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const safeName = name || "hola";
  const subject = "Verificá tu correo";
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.4">
      <h2>Verificación de correo</h2>
      <p>${safeName}, para activar tu cuenta hacé click acá:</p>
      <p><a href="${verifyUrl}">Verificar correo</a></p>
      <p>Si no fuiste vos, ignorá este email.</p>
    </div>
  `;
  const text = `${safeName}, verificá tu correo: ${verifyUrl}`;
  return sendEmail({ to, subject, html, text });
}

/** Email: reset password */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = name || "hola";
  const subject = "Restablecer contraseña";
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.4">
      <h2>Restablecer contraseña</h2>
      <p>${safeName}, solicitaste restablecer tu contraseña.</p>
      <p><a href="${resetUrl}">Crear nueva contraseña</a></p>
      <p>Si no fuiste vos, ignorá este email.</p>
    </div>
  `;
  const text = `${safeName}, restablecé tu contraseña: ${resetUrl}`;
  return sendEmail({ to, subject, html, text });
}
