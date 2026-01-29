import { Resend } from 'resend';

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const EMAIL_FROM = 'Salud Mental CR <onboarding@resend.dev>'; // Recuerda verificar tu dominio en Resend para producción

export const sendVerificationEmail = async (email, token) => {
  // 1. Inicializamos Resend AQUÍ DENTRO para evitar errores en el Build
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ ERROR: RESEND_API_KEY no está configurada.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const confirmLink = `${DOMAIN}/auth/verify-email?token=${token}`;

  try {
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
  } catch (error) {
    console.error("Error enviando email de verificación:", error);
    throw error; // Relanzar para manejarlo en la llamada
  }
};

export const sendPasswordResetEmail = async (email, token) => {
  // Inicialización Lazy
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ ERROR: RESEND_API_KEY no está configurada.");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const resetLink = `${DOMAIN}/auth/reset-password?token=${token}`;

  try {
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
  } catch (error) {
    console.error("Error enviando email de reset:", error);
    throw error;
  }
};