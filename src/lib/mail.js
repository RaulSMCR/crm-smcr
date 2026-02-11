// PATH: src/lib/mail.js
import { Resend } from "resend";

const DOMAIN =
  process.env.NEXT_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://saludmentalcostarica.com");

const EMAIL_FROM = "Salud Mental CR <onboarding@resend.dev>";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY no configurada.");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

/* =========================================================
   VERIFICACIÓN DE EMAIL
   ========================================================= */

export async function sendVerificationEmail(email, token) {
  const resend = getResend();
  if (!resend) return;

  const confirmLink = `${DOMAIN}/verificar-email?token=${token}`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Confirmá tu cuenta - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Confirmá tu cuenta</h2>
          <p>Gracias por registrarte en <b>Salud Mental CR</b>.</p>
          <p>Para activar tu cuenta hacé click en el botón:</p>

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
            Si no creaste esta cuenta, simplemente ignorá este mensaje.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error enviando email de verificación:", error);
    throw error;
  }
}
