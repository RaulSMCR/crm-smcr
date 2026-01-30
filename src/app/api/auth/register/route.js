import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma"; // Usamos tu singleton centralizado
import { generateSecurityToken } from "@/lib/tokens"; // Usamos el generador unificado
import { sendVerificationEmail } from "@/lib/mail"; // Usamos el mailer unificado

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, email, password, gender, interests } = body ?? {};

    // 1. Validaciones
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: nombre, email o contraseña." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Verificar duplicados
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con este correo." },
        { status: 409 }
      );
    }

    // 3. Preparar Seguridad
    const hashedPassword = await bcrypt.hash(String(password), 12);
    
    // Generar token usando la librería centralizada
    const { token, tokenHash, expiresAt } = generateSecurityToken();

    // 4. Crear Usuario en DB
    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        
        // Campos opcionales
        gender: gender ? String(gender).trim() : null,
        interests: interests ? String(interests).trim() : null,

        // Auth y Verificación
        emailVerified: false,
        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
        verifyEmailLastSentAt: new Date(),
        
        // Rol por defecto
        role: 'USER'
      },
    });

    // 5. Enviar Email (Usando la infraestructura centralizada)
    try {
      // Esto enviará el link correcto: /auth/verify-email?token=...
      await sendVerificationEmail(newUser.email, token);
    } catch (emailError) {
      console.error("⚠️ Usuario creado, pero falló el envío del email:", emailError);
      // No bloqueamos el registro, pero el frontend debería avisar
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Cuenta creada con éxito. Revisa tu correo para verificarla.",
        userId: newUser.id
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el registro." },
      { status: 500 }
    );
  }
}