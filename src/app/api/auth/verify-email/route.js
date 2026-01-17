import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Token faltante." }, { status: 400 });

    const now = new Date();
    const tokenHash = sha256Hex(token);

    // Primero Professional
    const prof = await prisma.professional.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: now },
        emailVerified: false,
      },
      select: { id: true },
    });

    if (prof) {
      await prisma.professional.update({
        where: { id: prof.id },
        data: {
          emailVerified: true,
          verifyTokenHash: null,
          verifyTokenExp: null,
        },
      });
      return NextResponse.json({ ok: true, entity: "PROFESSIONAL" });
    }

    // Luego User
    const user = await prisma.user.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: now },
        emailVerified: false,
      },
      select: { id: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verifyTokenHash: null,
          verifyTokenExp: null,
        },
      });
      return NextResponse.json({ ok: true, entity: "USER" });
    }

    return NextResponse.json({ error: "Token inválido o expirado." }, { status: 400 });
  } catch (err) {
    console.error("verify-email error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
