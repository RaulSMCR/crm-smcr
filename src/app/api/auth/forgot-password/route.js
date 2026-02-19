// src/app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { sendResetPasswordEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request) {
  const neutral = {
    ok: true,
    message: "Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.",
  };

  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return json({ error: "Email inválido." }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    // Respuesta neutra SIEMPRE (no revelar si existe el email)
    if (!user || user.isActive === false) {
      return json(neutral, 200);
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const exp = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExp: exp,
      },
    });

    await sendResetPasswordEmail(user.email, rawToken);

    return json(neutral, 200);
  } catch (e) {
    console.error("forgot-password error:", e);
    // neutro por seguridad
    return json(neutral, 200);
  }
}
