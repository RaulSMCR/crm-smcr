// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { serialize } from "cookie";

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured: falta JWT_SECRET en .env" },
        { status: 500 }
      );
    }

    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

    // Leer body JSON enviado desde el formulario
    const body = await request.json();

    const { name, email, password, age, gender, interests } = body ?? {};

    // Validaciones mínimas
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, email, password" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Edad opcional (si viene, validarla)
    const parsedAge =
      age !== undefined && age !== null && String(age).trim() !== ""
        ? Number(age)
        : null;

    if (
      parsedAge !== null &&
      (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120)
    ) {
      return NextResponse.json({ error: "Edad inválida" }, { status: 400 });
    }

    // Evitar duplicados
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(String(password), 12);

    // Crear usuario (ajusta estos campos según tu schema.prisma)
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashedPassword,

        // ✅ nuevos campos (opcionales, texto libre)
        age: parsedAge,
        gender: gender ? String(gender).trim() : null,
        interests: interests ? String(interests).trim() : null,
      },
      // No devolver password
      select: {
        id: true,
        name: true,
        email: true,
        age: true,
        gender: true,
        interests: true,
      },
    });

    // Login automático (cookie con JWT)
    const payload = { userId: newUser.id, name: newUser.name, role: "USER" };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(JWT_SECRET);

    const cookie = serialize("sessionToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hora
      path: "/",
    });

    const response = NextResponse.json(newUser, { status: 201 });
    response.headers.set("Set-Cookie", cookie);
    return response;
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return NextResponse.json(
      { error: "Error interno al registrar usuario" },
      { status: 500 }
    );
  }
}
