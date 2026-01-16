// src/app/api/auth/reset-password/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || "");
    const password = String(body?.password || "");

    if (!token || !password) {
      return NextResponse.json({ message: "Token y contraseña requeridos" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const tokenHash = sha256Hex(token);

    // Buscar en User
    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExp: { gt: new Date() } },
      select: { id: true },
    });

    // Si no es User, buscar en Professional
    const pro = !user
      ? await prisma.professional.findFirst({
          where: { resetTokenHash: tokenHash, resetTokenExp: { gt: new Date() } },
          select: { id: true },
        })
      : null;

    if (!user && !pro) {
      return NextResponse.json({ message: "Token inválido o expirado" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExp: null,
        },
      });
    } else {
      await prisma.professional.update({
        where: { id: pro.id },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExp: null,
        },
      });
    }

    return NextResponse.json({ ok: true, message: "Contraseña actualizada. Ya podés iniciar sesión." });
  } catch (e) {
    console.error("RESET_PASSWORD_ERROR:", e);
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}
