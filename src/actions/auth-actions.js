'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Resend } from 'resend';

// Configuración de Resend y JWT
const resend = new Resend(process.env.RESEND_API_KEY);
const secretKey = process.env.JWT_SECRET || "secret-key-change-me-in-prod";
const key = new TextEncoder().encode(secretKey);
const BASE_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

/* -------------------------------------------------------------------------- */
/* 1. GESTIÓN DE SESIÓN                                                       */
/* -------------------------------------------------------------------------- */

export async function getSession() {
  const cookieStore = cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, key, { algorithms: ["HS256"] });
    return payload;
  } catch (error) { return null; }
}

export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) return { error: "Credenciales requeridas." };

  // 1. Buscar usuario (primero en Profesionales, luego en Usuarios)
  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  // 2. Validar contraseña
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Credenciales inválidas." };
  }

  // 3. BLOQUEO: Si es profesional y NO está aprobado
  if (role === 'PROFESSIONAL' && !user.isApproved) {
    return { error: "Tu cuenta está pendiente de aprobación por la administración. Recibirás un aviso cuando se active." };
  }

  // 4. Crear Sesión
  const sessionData = {
    userId: user.id,
    email: user.email,
    role: role,
    user: { name: user.name }, 
    profile: user 
  };

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
  const session = await new SignJWT(sessionData)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  cookies().set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  return { success: true, role };
}

export async function logout() {
  cookies().set("session", "", { expires: new Date(0) });
  redirect("/ingresar");
}

/* -------------------------------------------------------------------------- */
/* 2. REGISTRO PROFESIONAL (Con Logs de Email)                                */
/* -------------------------------------------------------------------------- */

export async function registerProfessional(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const specialty = formData.get('specialty');
  
  // Datos Perfil
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');
  const coverLetter = formData.get('coverLetter'); 
  const cvFile = formData.get('cv'); 

  // Validaciones
  if (!name || !email || !password || !specialty) return { error: "Campos obligatorios incompletos." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener 8 caracteres mínimo." };

  try {
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    // Generar Slug
    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professional.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) count++;
    slug = count === 0 ? slug : `${slug}-${count}`;

    // CV Placeholder
    let cvUrl = null;
    if (cvFile && cvFile.size > 0) cvUrl = `pending_upload_${Date.now()}_${cvFile.name}`;

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 12); 
    
    // Tokens de Verificación
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Crear en DB
    await prisma.professional.create({
      data: {
        name, email, password: hashedPassword, specialty, slug,
        phone: phone || null, bio: bio || null, coverLetter: coverLetter || null, cvUrl, 
        isApproved: false, // Pendiente de aprobación
        emailVerified: false,
        verifyTokenHash, verifyTokenExp, verifyEmailLastSentAt: new Date(),
      }
    });

    // --- LOGS DE EMAIL PARA DEBUGGING ---
    console.log(`[Email Debug] Iniciando envío a: ${email}`);
    
    if (process.env.RESEND_API_KEY) {
      const verificationUrl = `${BASE_URL}/verificar-email?token=${verifyToken}`;
      
      const { data, error } = await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>', // ⚠️ Cambia esto si ya tienes dominio verificado
        to: email, // ⚠️ En modo prueba (Sandbox) solo funciona si envías a TU PROPIO email
        subject: 'Verifica tu cuenta profesional',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h1>Bienvenido, ${name}</h1>
            <p>Gracias por registrarte en Salud Mental Costa Rica.</p>
            <p>Por favor verifica tu correo para continuar con el proceso de admisión:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #003366; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Verificar Email</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">Si no creaste esta cuenta, ignora este mensaje.</p>
          </div>
        `
      });

      if (error) {
        console.error("❌ [Email Error] Resend falló:", error);
      } else {
        console.log("✅ [Email Éxito] ID:", data?.id);
      }
    } else {
      console.warn("⚠️ [Email Alerta] No se encontró RESEND_API_KEY en las variables de entorno.");
    }

    return { success: true };

  } catch (error) {
    console.error("Error crítico en registro profesional:", error);
    return { error: "Error interno del sistema." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. REGISTRO USUARIO (PACIENTE)                                             */
/* -------------------------------------------------------------------------- */

export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  // Otros campos opcionales
  const phone = formData.get('phone');
  const identification = formData.get('identification');
  const birthDate = formData.get('birthDate');
  const gender = formData.get('gender');
  const interests = formData.get('interests');

  if (!name || !email || !password) return { error: "Faltan datos obligatorios." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Correo ya registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let birthDateObj = null;
    if (birthDate) birthDateObj = new Date(birthDate);

    await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword,
        phone: phone || null,
        identification: identification || null,
        birthDate: birthDateObj,
        // Si tu schema tiene estos campos, descomenta:
        // gender: gender || null,
        // interests: interests || null
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrar usuario." };
  }
}