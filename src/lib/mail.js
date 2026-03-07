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
      subject: "Verificación de cuenta - Salud Mental CR",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.5; color:#111">
          <h2>Verificación de cuenta</h2>
          <p>Gracias por registrarse en <b>Salud Mental CR</b>.</p>
          <p>Para proteger su acceso y continuar con el proceso, utilice el siguiente botón:</p>
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
            Este enlace expirará pronto.
            Si esta acción no fue solicitada, puede ignorar este mensaje con tranquilidad.
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
    console.error("Error enviando email de verificaciÃ³n:", error);
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
          <p>Se recibió una solicitud para restablecer la contraseña de su cuenta en <b>Salud Mental CR</b>.</p>
          <p>Para continuar de forma segura, utilice el siguiente botón:</p>
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
            Este enlace expirará pronto.
            Si esta solicitud no fue realizada, puede ignorar este mensaje con tranquilidad.
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




