// src/app/api/auth/verify-email/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ------------------------------------------------------------------
// Prisma Singleton
// ------------------------------------------------------------------
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token ? String(body.token) : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token faltante" },
        { status: 400 }
      );
    }

    const tokenHash = sha256Hex(token);

    const user = await prisma.user.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: new Date() },
      },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Token inválido o expirado" },
        { status: 400 }
      );
    }

    // Si ya estaba verificado, respondemos OK igual (idempotente)
    if (user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyTokenHash: null,
        verifyTokenExp: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR:", error);
    return NextResponse.json(
      { ok: false, message: error?.message || "Error interno" },
      { status: 500 }
    );
  }
}
