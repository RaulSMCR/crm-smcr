import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const EMAIL_FROM = 'Salud Mental CR <onboarding@resend.dev>'; // Cambia esto cuando tengas dominio verificado en Resend

export const sendVerificationEmail = async (email, token) => {
  const confirmLink = `${DOMAIN}/auth/verify-email?token=${token}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Verifica tu correo - CRM SMCR',
    html: `
      <h1>Confirma tu cuenta</h1>
      <p>Gracias por registrarte. Por favor confirma tu correo haciendo click aquí:</p>
      <a href="${confirmLink}">Verificar Correo</a>
      <p>Este enlace expira en 1 hora.</p>
    `
  });
};

export const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${DOMAIN}/auth/reset-password?token=${token}`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: 'Restablecer Contraseña - CRM SMCR',
    html: `
      <h1>Recuperar Contraseña</h1>
      <p>Has solicitado cambiar tu contraseña. Haz click en el siguiente enlace:</p>
      <a href="${resetLink}">Cambiar Contraseña</a>
      <p>Si no fuiste tú, ignora este correo.</p>
    `
  });
};