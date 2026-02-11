//src/actions/reset-password-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function genericOkMessage() {
  // Anti-enumeración: siempre el mismo mensaje aunque no exista el email
  return {
    success: true,
    message: "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
  };
}

/**
 * Solicitar reset (desde /recuperar)
 * Recibe FormData: email
 */
export async function requestPasswordReset(formData) {
  try {
    const email = normalizeEmail(formData?.get("email"));

    if (!email) return genericOkMessage();

    // En tu arquitectura actual, profesionales también viven en User (role=PROFESSIONAL)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        resetTokenExp: true,
        isActive: true,
      },
    });

    // No existe => respondemos igual
    if (!user) return genericOkMessage();

    // Cuenta desactivada => respondemos igual (no filtramos)
    if (user.isActive === false) return genericOkMessage();

    // Throttle magro: si ya hay token vigente, no spameamos correos
    const now = Date.now();
    if (user.resetTokenExp && user.resetTokenExp.getTime() > now + 5 * 60 * 1000) {
      return genericOkMessage();
    }

    // Token real (solo por email)
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: tokenHash, // 👈 usamos resetToken como HASH
        resetTokenExp: expiresAt,
      },
    });

    // Email no bloqueante (pero si falla, igual respondemos genérico)
    try {
      await sendPasswordResetEmail(email, token);
    } catch (e) {
      console.error("PASSWORD_RESET_EMAIL_ERROR:", e);
    }

    return genericOkMessage();
  } catch (e) {
    console.error("requestPasswordReset error:", e);
    // Incluso en error, respuesta genérica por seguridad
    return genericOkMessage();
  }
}

/**
 * Completar reset (desde /cambiar-password?token=...)
 * Recibe FormData: token, password, confirmPassword
 */
export async function resetPassword(formData) {
  try {
    const token = String(formData?.get("token") || "").trim();
    const password = String(formData?.get("password") || "");
    const confirmPassword = String(formData?.get("confirmPassword") || "");

    if (!token) return { error: "Token faltante o inválido." };

    if (!password || password.length < 8) {
      return { error: "La contraseña debe tener al menos 8 caracteres." };
    }

    if (password !== confirmPassword) {
      return { error: "Las contraseñas no coinciden." };
    }

    const tokenHash = sha256Hex(token);
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExp: { gt: now },
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) {
      return { error: "El enlace es inválido o expiró. Pedí uno nuevo en /recuperar." };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword, // 👈 tu schema actual usa `password`
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return { success: true, message: "Contraseña actualizada. Ya podés iniciar sesión." };
  } catch (e) {
    console.error("resetPassword error:", e);
    return { error: "Error interno al restablecer la contraseña." };
  }
}
