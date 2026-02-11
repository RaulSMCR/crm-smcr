// PATH: src/app/api/auth/resend-verification/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export async function POST(req) {
  // Respuesta SIEMPRE genérica (anti enumeración)
  const genericOk = NextResponse.json({
    ok: true,
    message: "Si ese correo existe en el sistema, te enviamos un nuevo enlace de verificación.",
  });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return genericOk;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, isActive: true },
    });

    if (!user) return genericOk;
    if (user.isActive === false) return genericOk;
    if (user.emailVerified) return genericOk;

    // Nuevo token + hash + exp (1 hora)
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

    // Envío no bloqueante (no romper UX)
    try {
      await sendVerificationEmail(email, token);
    } catch (e) {
      console.error("RESEND_VERIFICATION_EMAIL_ERROR:", e);
    }

    return genericOk;
  } catch (e) {
    console.error("resend-verification error:", e);
    return genericOk;
  }
}
