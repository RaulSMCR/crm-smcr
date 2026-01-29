// src/app/api/auth/register-professional/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateSecurityToken } from "@/lib/tokens"; // Usamos tu nuevo generador
import { sendVerificationEmail } from "@/lib/mail";   // Usamos tu nuevo servicio de mail

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      nombreCompleto,
      profesion,
      email,
      telefono,
      password,
      introVideoUrl,
    } = body ?? {};

    // 1. Validaciones básicas
    if (!nombreCompleto || !profesion || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (nombre, profesión, email, contraseña)." },
        { status: 400 }
      );
    }

    const emailNormalizado = String(email).trim().toLowerCase();

    // 2. Verificar duplicados (Email único)
    const existente = await prisma.professional.findUnique({
      where: { email: emailNormalizado },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un profesional registrado con este email." },
        { status: 409 }
      );
    }

    // 3. Preparar seguridad (Password + Token de Verificación)
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generamos el token para verificar el email inmediatamente
    const { token, tokenHash, expiresAt } = generateSecurityToken();

    // 4. Crear Profesional en Base de Datos
    const newPro = await prisma.professional.create({
      data: {
        name: String(nombreCompleto).trim(),
        profession: String(profesion).trim(),
        email: emailNormalizado,
        phone: telefono ? String(telefono).trim() : null,
        passwordHash: hashedPassword,
        
        // Campos opcionales
        introVideoUrl: introVideoUrl ? String(introVideoUrl) : null,
        
        // ESTADO INICIAL:
        isApproved: false,       // Requiere aprobación del Admin
        emailVerified: false,    // Requiere clic en el email
        
        // Guardamos el token de verificación
        verifyTokenHash: tokenHash,
        verifyTokenExp: expiresAt,
        verifyEmailLastSentAt: new Date(),
      },
    });

    console.log(`✅ Profesional creado: ${emailNormalizado} (ID: ${newPro.id})`);

    // 5. Enviar Email de confirmación
    // Usamos la función robusta que creamos en lib/mail.js
    try {
      await sendVerificationEmail(emailNormalizado, token);
    } catch (emailError) {
      console.error("⚠️ El usuario se creó, pero falló el envío del email:", emailError);
      // No retornamos error 500 para no bloquear el registro, pero el usuario deberá pedir reenvío.
    }

    return NextResponse.json({ 
      ok: true, 
      id: newPro.id,
      message: "Registro exitoso. Por favor revisa tu correo para verificar la cuenta." 
    }, { status: 201 });

  } catch (error) {
    console.error("❌ Error en registro profesional:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el registro." },
      { status: 500 }
    );
  }
}