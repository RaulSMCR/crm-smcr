// src/actions/reset-password-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Resetea contraseña usando token y nueva contraseña.
 * Asume en Prisma User:
 * - password (string)
 * - resetToken (string?)
 * - resetTokenExp (DateTime?)
 * - isActive (boolean)
 */
export async function resetPasswordAction({ token, newPassword }) {
  try {
    if (!token || typeof token !== "string") {
      return { ok: false, error: "Token inválido." };
    }
    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) {
      return { ok: false, error: "El enlace expiró o no es válido." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash, // luego lo migraremos a passwordHash en el plan grande
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error("resetPasswordAction error:", e);
    return { ok: false, error: "Error interno. Intenta de nuevo." };
  }
}
