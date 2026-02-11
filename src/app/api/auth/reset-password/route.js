// src/app/api/auth/reset-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const { token, password, confirmPassword } = await request.json();

    const rawToken = String(token || "");
    const newPassword = String(password || "");
    const confirm = String(confirmPassword || "");

    if (!rawToken) return json({ error: "Token faltante." }, 400);
    if (!newPassword || newPassword.length < 8)
      return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    if (newPassword !== confirm) return json({ error: "Las contraseñas no coinciden." }, 400);

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExp: { gt: new Date() },
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) return json({ error: "El enlace expiró o no es válido." }, 400);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash, // luego migraremos a passwordHash
        resetToken: null,
        resetTokenExp: null,
      },
    });

    return json({ ok: true, message: "Contraseña actualizada. Ya podés ingresar." }, 200);
  } catch (e) {
    console.error("reset-password error:", e);
    return json({ error: "Error interno. Intenta de nuevo." }, 500);
  }
}
