// apps/web/lib/email.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerifyEmail({ to, name, verifyUrl }) {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("Missing EMAIL_FROM");
  if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

  const subject = "Confirmá tu correo";

  const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.5">
    <h2>Confirmación de correo</h2>
    <p>Hola${name ? `, ${name}` : ""}. Para activar tu cuenta, confirmá tu correo:</p>
    <p><a href="${verifyUrl}" target="_blank" rel="noreferrer">Confirmar mi correo</a></p>
    <p>Si no fuiste vos, ignorá este mensaje.</p>
  </div>
  `;

  await resend.emails.send({ from, to, subject, html });
}
