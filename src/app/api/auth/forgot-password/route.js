// src/app/api/auth/forgot-password/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { sendResetPasswordEmail } from "@/lib/mail";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request) {
  const neutral = {
    ok: true,
    message: "Si el correo existe, se enviará un enlace para restablecer la contraseña y continuar avanzando con acceso protegido.",
  };

  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return json({ error: "Correo electrónico inválido." }, 400);
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Verificación de Turnstile (se omite si no hay TURNSTILE_SECRET_KEY).
    const captchaOk = await verifyTurnstile(body?.captchaToken, ip);
    if (!captchaOk) {
      return json({ error: "La verificación de seguridad falló. Recargá la página e intentá de nuevo." }, 403);
    }

    // Rate limit: 3 / 60 min por IP y 3 / 60 min por email. Si está limitado
    // devolvemos la MISMA respuesta neutra y NO enviamos correo (anti-bombardeo).
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit(`forgot:${ip}`, { max: 3, windowMinutes: 60 }),
      checkRateLimit(`forgot:${email}`, { max: 3, windowMinutes: 60 }),
    ]);
    if (byIp.limited || byEmail.limited) {
      console.warn(`[forgot-password] rate limit alcanzado (ip=${byIp.limited}, email=${byEmail.limited}). Sin envío.`);
      return json(neutral, 200);
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

