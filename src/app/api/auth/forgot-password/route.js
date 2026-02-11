// src/app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { sendEmail } from "@/lib/mail";
import { renderResetPasswordEmail } from "@/lib/email-templates";

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function safeUrl(base, pathWithQuery) {
  // base debe ser algo como https://saludmentalcostarica.com
  // si base viene undefined, usamos Vercel URL cuando exista
  const normalized = base?.startsWith("http") ? base : `https://${base}`;
  return new URL(pathWithQuery, normalized).toString();
}

export async function POST(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const { email } = await request.json();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return json({ error: "Email inválido." }, 400);
    }

    // Respuesta neutra SIEMPRE (no revelar si existe o no)
    const neutral = {
      ok: true,
      message: "Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.",
    };

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || user.isActive === false) {
      return json(neutral, 200);
    }

    // Generar token (guardamos HASH en DB por seguridad)
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const exp = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: tokenHash,
        resetTokenExp: exp,
      },
    });

    // Armar URL de reset
    // Recomendado: setear APP_URL en Vercel (Production/Preview)
    const appUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

    const resetLink = safeUrl(appUrl, `/cambiar-password?token=${rawToken}`);

    // Enviar email (usa tu infra existente)
    const html = renderResetPasswordEmail({ resetLink });

    await sendEmail({
      to: user.email,
      subject: "Restablecer contraseña",
      html,
    });

    return json(neutral, 200);
  } catch (e) {
    console.error("forgot-password error:", e);
    // respuesta neutra por seguridad
    return json(
      { ok: true, message: "Si el correo existe, te enviaremos un enlace para restablecer tu contraseña." },
      200
    );
  }
}
