import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const now = new Date();
    const tokenHash = sha256Hex(token);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const prof = await prisma.professional.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExp: { gt: now } },
      select: { id: true },
    });

    if (prof) {
      await prisma.professional.update({
        where: { id: prof.id },
        data: { passwordHash, resetTokenHash: null, resetTokenExp: null },
      });
      return NextResponse.json({ ok: true, entity: "PROFESSIONAL" });
    }

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExp: { gt: now } },
      select: { id: true },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetTokenHash: null, resetTokenExp: null },
      });
      return NextResponse.json({ ok: true, entity: "USER" });
    }

    return NextResponse.json({ error: "Token inválido o expirado." }, { status: 400 });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
