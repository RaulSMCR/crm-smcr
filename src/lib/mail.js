// PATH: src/lib/mail.js
import { Resend } from "resend";

const DOMAIN =
  process.env.NEXT_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://saludmentalcostarica.com");

const EMAIL_FROM =
  process.env.NOTIFICATIONS_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  "Salud Mental CR <no-reply@saludmentalcostarica.com>";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY no configurada.");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(email, token) {
  const resend = getResend();
  if (!resend) return;

  const confirmLink = `${DOMAIN}/verificar-email?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Confirma tu cuenta - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Confirma tu cuenta</h2>
          <p>Gracias por registrarte en <b>Salud Mental CR</b>.</p>
          <p>Para activar tu cuenta haz click en el botón:</p>
          <p style="margin:25px 0">
            <a href="${confirmLink}"
              style="
                background:#2563eb;
                color:white;
                padding:12px 22px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block">
              Verificar correo
            </a>
          </p>
          <p style="font-size:12px;color:#555">
            Este enlace expirará pronto.
            Si no creaste esta cuenta, simplemente ignora este mensaje.
          </p>
        </div>
      `,
    });

    if (result?.error) {
      console.error("RESEND_VERIFICATION_SEND_ERROR:", result.error);
      throw new Error(
        typeof result.error === "string" ? result.error : result.error.message || "Resend verification send failed."
      );
    }
  } catch (error) {
    console.error("Error enviando email de verificación:", error);
    throw error;
  }
}

export async function sendResetPasswordEmail(email, token) {
  const resend = getResend();
  if (!resend) return;

  const resetLink = `${DOMAIN}/cambiar-password?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Restablecer contraseña - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Restablecer contraseña</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña en <b>Salud Mental CR</b>.</p>
          <p>Si fuiste vos, haz click en el botón:</p>
          <p style="margin:25px 0">
            <a href="${resetLink}"
              style="
                background:#111827;
                color:white;
                padding:12px 22px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block">
              Crear nueva contraseña
            </a>
          </p>
          <p style="font-size:12px;color:#555">
            Este enlace expirará pronto.
            Si no pediste este cambio, puedes ignorar este mensaje.
          </p>
        </div>
      `,
    });

    if (result?.error) {
      console.error("RESEND_RESET_SEND_ERROR:", result.error);
      throw new Error(
        typeof result.error === "string" ? result.error : result.error.message || "Resend reset send failed."
      );
    }
  } catch (error) {
    console.error("Error enviando email de reset:", error);
    throw error;
  }
}
