// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateSecurityToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { signToken } from "@/lib/auth"; // Necesario para loguear automáticamente

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, email, password, identification, birthDate, phone, gender, interests } = body;

    // 1. Validaciones
    if (!name || !email || !password || !identification || !birthDate) {
      return NextResponse.json({ error: "Faltan datos obligatorios." }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Duplicados
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "Ya existe un usuario con este correo." }, { status: 409 });
    }

    // 3. Seguridad
    const hashedPassword = await bcrypt.hash(String(password), 12);
    const { token, tokenHash, expiresAt } = generateSecurityToken();

    // 4. Crear Usuario
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        identification: String(identification).trim(),
        phone: phone ? String(phone).trim() : null,
        birthDate: new Date(birthDate),
        gender: gender ? String(gender).trim() : null,
        interests: interests ? String(interests).trim() : null,
        emailVerified: false,
        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
        verifyEmailLastSentAt: new Date(),
        role: 'USER'
      },
    });

    // 5. Generar Token de Sesión Inmediata
    // Esto permite que el usuario agende aunque el mail de verificación tarde
    const sessionToken = await signToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // 6. Intento de Envío de Email (No bloqueante)
    let emailSent = true;
    try {
      await sendVerificationEmail(newUser.email, token);
    } catch (emailError) {
      console.error("⚠️ EMAIL_SEND_FAILURE:", emailError.message);
      emailSent = false; 
      // No devolvemos error 500 para no romper el registro
    }

    // 7. Respuesta con Cookie de sesión
    const response = NextResponse.json({
      ok: true,
      token: sessionToken,
      emailSent, // Informamos al front si el mail falló
      message: emailSent 
        ? "Registro exitoso. Verifica tu correo." 
        : "Registro exitoso, pero hubo un problema al enviar el correo de verificación. Puedes agendar y verificar tu cuenta más tarde."
    }, { status: 201 });

    response.cookies.set("sessionToken", sessionToken, {
      httpOnly: false, // Para que SmartScheduleButton lo lea
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return NextResponse.json({ error: "Error interno: " + error.message }, { status: 500 });
  }
}