// src/app/api/auth/register-professional/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Función auxiliar para escapar HTML en correos
function escaparHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

    // 2. Verificar duplicados
    const existente = await prisma.professional.findUnique({
      where: { email: emailNormalizado },
    });

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un profesional registrado con este email." },
        { status: 409 }
      );
    }

    // 3. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    /* 4. Crear Profesional en Base de Datos
       NOTA: Solo guardamos los campos que EXISTEN en tu schema.prisma actual.
       He eliminado 'emailVerified', 'tokens', 'bio', 'resumeUrl', etc. para evitar el error 500.
    */
    const newPro = await prisma.professional.create({
      data: {
        name: String(nombreCompleto).trim(),
        profession: String(profesion).trim(),
        email: emailNormalizado,
        // Asumiendo que agregaste 'phone' al schema como sugerí antes. Si falla, comenta esta línea:
        phone: telefono ? String(telefono).trim() : null,
        
        passwordHash: hashedPassword,
        
        // Campos opcionales válidos
        introVideoUrl: introVideoUrl ? String(introVideoUrl) : null,
        
        // Estado inicial: Pendiente de aprobación
        isApproved: false, 
      },
    });

    console.log(`✅ Nueva solicitud de profesional creada: ${emailNormalizado} (ID: ${newPro.id})`);

    // 5. Enviar Email de confirmación (Envuelto en try/catch para no bloquear el registro si falla el correo)
    try {
      if (typeof sendEmail === 'function') {
        await sendEmail({
          to: emailNormalizado,
          subject: "Recibimos tu solicitud de profesional",
          html: `
            <p>Hola ${escaparHtml(nombreCompleto)}.</p>
            <p>Hemos recibido tu solicitud para unirte a la plataforma.</p>
            <p><strong>Tu perfil está en estado PENDIENTE.</strong> Un administrador revisará tus datos y te contactará para una entrevista o validación.</p>
            <p>Tu perfil no será público hasta que sea aprobado.</p>
          `,
        });
      }
    } catch (emailError) {
      console.error("⚠️ Advertencia: No se pudo enviar el email de confirmación, pero el usuario se creó.", emailError);
    }

    return NextResponse.json({ ok: true, id: newPro.id }, { status: 201 });

  } catch (error) {
    console.error("❌ Error CRÍTICO en registro profesional:", error);
    
    // Devolvemos el mensaje exacto del error para facilitar el debugging en el frontend
    return NextResponse.json(
      { error: "No se pudo crear el profesional. " + (error.message || "") },
      { status: 500 }
    );
  }
}