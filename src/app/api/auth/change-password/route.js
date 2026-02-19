// src/app/api/auth/change-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "No autorizado." }, 401);

    const userId = String(session.sub || session.userId || "");
    if (!userId) return json({ error: "Sesión inválida." }, 401);

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const body = await request.json().catch(() => ({}));
    const current = String(body?.currentPassword || body?.current || "");
    const next = String(body?.newPassword || body?.password || "");
    const confirm = String(body?.confirmPassword || "");

    if (!current) return json({ error: "Contraseña actual requerida." }, 400);
    if (!next || next.length < 8) {
      return json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, 400);
    }
    if (confirm && next !== confirm) {
      return json({ error: "Las contraseñas no coinciden." }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user || user.isActive === false) {
      return json({ error: "Usuario no encontrado o inactivo." }, 404);
    }

    const ok = await bcrypt.compare(current, user.passwordHash || "");
    if (!ok) return json({ error: "La contraseña actual es incorrecta." }, 400);

    const passwordHash = await bcrypt.hash(next, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return json({ ok: true, message: "Contraseña actualizada." }, 200);
  } catch (e) {
    console.error("change-password error:", e);
    return json({ error: "Error interno. Intenta de nuevo." }, 500);
  }
}
