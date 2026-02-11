// src/app/api/auth/verify-email/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signToken, setSessionCookie } from "@/lib/auth";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    if (!token) {
      return NextResponse.json({ error: "Token faltante." }, { status: 400 });
    }

    const now = new Date();
    const tokenHash = sha256Hex(token);

    // Buscar usuario pendiente de verificación
    const user = await prisma.user.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: now },
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Token inválido o expirado." }, { status: 400 });
    }

    // Marcar verificado y limpiar token
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyTokenHash: null,
        verifyTokenExp: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
        emailVerified: true,
      },
    });

    // Si es profesional y aún no está aprobado, no le damos acceso al panel profesional,
    // pero sí podemos iniciar sesión (tu middleware ya lo mandará a /espera-aprobacion).
    const jwt = await signToken({
      userId: updated.id,
      role: updated.role,
      email: updated.email,
      isApproved: updated.isApproved,
      emailVerified: updated.emailVerified,
    });

    const res = NextResponse.json({
      ok: true,
      entity: "USER",
      role: updated.role,
      isApproved: updated.isApproved,
    });

    // Cookie segura y consistente con middleware + getSession()
    setSessionCookie(res, jwt);

    return res;
  } catch (err) {
    console.error("verify-email error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
