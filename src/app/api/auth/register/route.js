// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { serialize } from "cookie";

// ------------------------------------------------------------------
// FIX: Patrón Singleton para evitar "Too many connections" en GoDaddy
// ------------------------------------------------------------------
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request) {
  try {
    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured: falta JWT_SECRET en .env" },
        { status: 500 }
      );
    }

    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

    // Leer body JSON
    const body = await request.json();

    // Nota: Eliminamos 'age' de aquí porque no existe en tu base de datos
    const { name, email, password, gender, interests } = body ?? {};

    // Validaciones mínimas
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, email, password" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

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

    // -------------------------------------------------------
    // CORRECCIÓN CRÍTICA AQUÍ ABAJO
    // -------------------------------------------------------
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        
        // FIX 1: Tu schema usa 'passwordHash', no 'password'
        passwordHash: hashedPassword, 

        // FIX 2: Eliminé 'age' porque tu schema no tiene ese campo.
        // Si quieres guardar edad, debes agregar el campo al schema.prisma primero.
        
        // Estos son opcionales y existen en tu schema:
        gender: gender ? String(gender).trim() : null,
        interests: interests ? String(interests).trim() : null,
        
        // Nota: 'role' se pone en "USER" automáticamente por defecto según tu schema
      },
      select: {
        id: true,
        name: true,
        email: true,
        gender: true,
        interests: true,
        // Eliminé 'age' del select también
      },
    });

    // Login automático (JWT)
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
    // Imprimir el error completo es vital para debuggear
    console.error("REGISTER_ERROR:", error);
    
    return NextResponse.json(
      // Enviamos el mensaje del error para que lo veas en el frontend temporalmente
      { error: `Error interno: ${error.message}` }, 
      { status: 500 }
    );
  }
}