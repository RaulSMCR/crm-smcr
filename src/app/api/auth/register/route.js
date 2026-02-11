// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateSecurityToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || "");

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Faltan datos obligatorios." }, { status: 400 });
    }

    // Password mínimo (magro, pero evita basura)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    // Evitar enumeración: respondemos genérico en caso de duplicado
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { ok: true, emailSent: true, message: "Si el correo es válido, recibirás un email de verificación." },
        { status: 200 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { token, tokenHash, expiresAt } = generateSecurityToken();

    // Crear usuario según TU schema
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,     // <-- TU schema: password (ideal: migrar a passwordHash luego)
        phone: body?.phone ? String(body.phone).trim() : null,

        role: "USER",
        isApproved: true,
        isActive: true,
        emailVerified: false,

        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
      },
      select: { id: true, email: true, name: true },
    });

    // Email no bloqueante
    let emailSent = true;
    try {
      await sendVerificationEmail(user.email, token);
    } catch (err) {
      console.error("⚠️ EMAIL_SEND_FAILURE:", err?.message || err);
      emailSent = false;
    }

    return NextResponse.json(
      {
        ok: true,
        emailSent,
        message: emailSent
          ? "Registro exitoso. Revisa tu correo para verificar tu cuenta."
          : "Registro exitoso. No pudimos enviar el correo de verificación en este momento. Intenta reenviar la verificación más tarde.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    const body =
      process.env.NODE_ENV === "production"
        ? { error: "Error interno del servidor." }
        : { error: "Error interno: " + (error?.message || "unknown") };
    return NextResponse.json(body, { status: 500 });
  }
}
