//src/lib/mail.js
import { Resend } from "resend";

const DOMAIN =
  process.env.NEXT_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://saludmentalcostarica.com");

const EMAIL_FROM = "Salud Mental CR <onboarding@resend.dev>";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ ERROR: RESEND_API_KEY no está configurada.");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export const sendVerificationEmail = async (email, token) => {
  const resend = getResend();
  if (!resend) return;

  // ✅ Ruta real en tu proyecto
  const confirmLink = `${DOMAIN}/verificar-email?token=${token}`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verifica tu correo - SMCR",
      html: `
        <div style="font-family: sans-serif; color: #111;">
          <h2>Confirmá tu cuenta</h2>
          <p>Gracias por registrarte. Confirmá tu correo haciendo click aquí:</p>
          <p><a href="${confirmLink}">Verificar correo</a></p>
          <p style="color:#555;font-size:12px;">Este enlace expira pronto. Si no solicitaste esto, podés ignorar el mensaje.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error enviando email de verificación:", error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, token) => {
  const resend = getResend();
  if (!resend) return;

  // ✅ Ruta real en tu proyecto
  const resetLink = `${DOMAIN}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Restablecer contraseña - SMCR",
      html: `
        <div style="font-family: sans-serif; color: #111;">
          <h2>Recuperar contraseña</h2>
          <p>Solicitaste cambiar tu contraseña. Usá este enlace:</p>
          <p><a href="${resetLink}">Cambiar contraseña</a></p>
          <p style="color:#555;font-size:12px;">Si no fuiste vos, ignorá este correo.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error enviando email de reset:", error);
    throw error;
  }
};
