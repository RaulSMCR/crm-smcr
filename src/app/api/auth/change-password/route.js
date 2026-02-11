// src/app/api/auth/change-password/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function getEncodedKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null; // defensivo
  return new TextEncoder().encode(secret);
}

async function getSessionPayload() {
  const token = cookies().get("session")?.value;
  if (!token) return null;

  const key = getEncodedKey();
  if (!key) return null;

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload; // { sub, role, ... }
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const payload = await getSessionPayload();
    if (!payload?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    const current = String(currentPassword || "");
    const next = String(newPassword || "");
    const confirm = String(confirmPassword || "");

    if (!current) return json({ error: "Debes ingresar tu contraseña actual." }, 400);
    if (!next || next.length < 8) return json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, 400);
    if (next !== confirm) return json({ error: "La confirmación no coincide." }, 400);

    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, password: true, isActive: true },
    });

    if (!user || user.isActive === false) {
      return json({ error: "Usuario inválido." }, 400);
    }

    // Verificar password actual
    const ok = await bcrypt.compare(current, user.password || "");
    if (!ok) {
      return json({ error: "La contraseña actual es incorrecta." }, 400);
    }

    // Guardar nueva password hasheada
    const passwordHash = await bcrypt.hash(next, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    return json({ ok: true, message: "Contraseña actualizada." }, 200);
  } catch (e) {
    console.error("change-password error:", e);
    return json({ error: "Error interno. Intenta de nuevo." }, 500);
  }
}
