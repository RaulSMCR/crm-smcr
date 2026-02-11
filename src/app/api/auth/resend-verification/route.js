// PATH: src/app/api/auth/resend-verification/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

// Rate limit simple por IP (en memoria; en serverless es "best effort")
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_MAX = 5;
const ipHits = new Map(); // ip -> { count, resetAt }

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getClientIp(req) {
  // Vercel / proxies
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const hit = ipHits.get(ip);

  if (!hit || now > hit.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }

  if (hit.count >= RATE_MAX) {
    return { ok: false, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  ipHits.set(ip, hit);
  return { ok: true };
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta más tarde." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    // Respuesta SIEMPRE genérica (no enumeración)
    const genericOk = NextResponse.json({
      ok: true,
      message: "Si ese correo existe en el sistema, te enviamos un nuevo enlace de verificación.",
    });

    if (!email) return genericOk;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verifyTokenExp: true,
      },
    });

    // Si no existe, respondemos igual
    if (!user) return genericOk;

    // Si ya está verificado, respondemos igual
    if (user.emailVerified) return genericOk;

    // Generar nuevo token + hash + exp (1 hora)
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
      },
    });

    // No bloqueante: si falla email, igual respondemos ok (evita enumeración y mejora UX)
    try {
      await sendVerificationEmail(email, token);
    } catch (e) {
      console.error("RESEND_VERIFICATION_EMAIL_ERROR:", e);
    }

    return genericOk;
  } catch (e) {
    console.error("resend-verification error:", e);
    // Incluso en error interno, respondemos genérico para no filtrar
    return NextResponse.json({
      ok: true,
      message: "Si ese correo existe en el sistema, te enviamos un nuevo enlace de verificación.",
    });
  }
}
