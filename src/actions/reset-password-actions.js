"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Server Action: resetea contraseña desde FormData
 * Espera:
 * - token
 * - password
 * - confirmPassword
 *
 * Requiere en Prisma User:
 * - password (String)
 * - resetToken (String?)
 * - resetTokenExp (DateTime?)
 * - isActive (Boolean)
 */
export async function resetPasswordAction(formData) {
  try {
    const token = String(formData.get("token") || "");
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!token) return { error: "Token faltante." };
    if (!password || password.length < 8)
      return { error: "La contraseña debe tener al menos 8 caracteres." };
    if (password !== confirmPassword)
      return { error: "Las contraseñas no coinciden." };

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: { gt: new Date() },
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) return { error: "El enlace expiró o no es válido." };

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash, // luego lo migraremos a passwordHash
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return { ok: true, message: "Contraseña actualizada. Ya podés ingresar." };
  } catch (e) {
    console.error("resetPasswordAction error:", e);
    return { error: "Error interno. Intenta de nuevo." };
  }
}
