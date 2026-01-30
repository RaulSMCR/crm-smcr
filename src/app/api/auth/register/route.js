// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateSecurityToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // 1. Extraemos TODOS los campos
    const { 
      name, 
      email, 
      password, 
      gender, 
      interests, 
      identification, 
      phone, 
      birthDate 
    } = body ?? {};

    // 2. Validaciones Obligatorias
    if (!name || !email || !password || !identification || !birthDate) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 3. Verificar duplicados
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este correo." },
        { status: 409 }
      );
    }

    // 4. Seguridad (Hash + Token)
    const hashedPassword = await bcrypt.hash(String(password), 12);
    const { token, tokenHash, expiresAt } = generateSecurityToken();

    // 5. Crear Usuario en DB
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        
        // Campos específicos
        identification: String(identification).trim(),
        phone: String(phone).trim(),
        birthDate: new Date(birthDate), 
        
        gender: gender ? String(gender).trim() : null,
        interests: interests ? String(interests).trim() : null,

        // Auth
        emailVerified: false,
        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
        verifyEmailLastSentAt: new Date(),
        role: 'USER'
      },
    });

    // 6. Enviar Email (CON REPORTE DE ERRORES PARA DEBUG)
    try {
      await sendVerificationEmail(newUser.email, token);
    } catch (emailError) {
      console.error("⚠️ CRITICAL EMAIL ERROR:", emailError);
      
      // ESTA ES LA PARTE IMPORTANTE:
      // Devolvemos un error 500 explícito con el mensaje técnico
      // para que lo puedas leer en el formulario.
      return NextResponse.json(
        { 
          error: `Usuario creado (ID: ${newUser.id}), pero FALLÓ el envío del correo: ${emailError.message || 'Error desconocido en Resend'}` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Cuenta creada exitosamente. Por favor verifica tu correo.",
        userId: newUser.id
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error.message },
      { status: 500 }
    );
  }
}