// PATH: src/lib/mail.js
import { Resend } from "resend";
import { SITE_URL as DOMAIN } from "@/lib/site-url";

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

/**
 * Vigencia de los enlaces, en horas. Viven junto a las plantillas a propósito:
 * el correo le promete un plazo al usuario, así que quien graba el token en la BD
 * debe usar la misma constante o el texto miente.
 */
export const VERIFY_TOKEN_TTL_HOURS = 24; // al registrarse
export const VERIFY_RESEND_TTL_HOURS = 1; // al pedir un reenvío
export const RESET_TOKEN_TTL_HOURS = 1;

/** Fecha de expiración a partir de una de las constantes de arriba. */
export function ttlToDate(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function hoursLabel(hours) {
  return hours === 1 ? "1 hora" : `${hours} horas`;
}

export async function sendVerificationEmail(email, token, expiresInHours = VERIFY_TOKEN_TTL_HOURS) {
  const resend = getResend();
  if (!resend) return;

  const confirmLink = `${DOMAIN}/verificar-email?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verificación de cuenta - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Verificación de cuenta</h2>
          <p>Gracias por registrarte en <b>Salud Mental CR</b>.</p>
          <p>Para confirmar tu cuenta, usá el siguiente botón:</p>
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
              Verificar correo y continuar
            </a>
          </p>
          <p style="font-size:12px;color:#555">
            El enlace vence en ${hoursLabel(expiresInHours)}; si se te vence, pedí uno nuevo desde la pantalla de ingreso.
            Si no fuiste vos quien creó la cuenta, podés ignorar este mensaje.
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
      subject: "Restablecimiento de contraseña - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Restablecimiento de contraseña</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <b>Salud Mental CR</b>.</p>
          <p>Para crear una contraseña nueva, usá el siguiente botón:</p>
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
              Crear nueva contraseña y continuar</a>
          </p>
          <p style="font-size:12px;color:#555">
            El enlace vence en ${hoursLabel(RESET_TOKEN_TTL_HOURS)}.
            Si no pediste el cambio, podés ignorar este mensaje: tu contraseña sigue igual.
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




