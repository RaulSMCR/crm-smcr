//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Resend } from 'resend';

// Configuración
const resend = new Resend(process.env.RESEND_API_KEY);
const secretKey = process.env.JWT_SECRET || "secret-key-change-me-in-prod";
const key = new TextEncoder().encode(secretKey);

/* -------------------------------------------------------------------------- */
/* 1. GESTIÓN DE SESIÓN (ESTAS SON LAS QUE FALTAN Y ROMPEN EL BUILD)          */
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

  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Credenciales inválidas." };
  }

  // Bloqueo por aprobación (Profesionales)
  if (role === 'PROFESSIONAL' && !user.isApproved) {
    return { error: "Tu cuenta está pendiente de aprobación por la administración." };
  }

  // Crear Sesión
  const sessionData = {
    userId: user.id,
    email: user.email,
    role: role,
    user: { name: user.name }, 
    profile: user 
  };

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
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
/* 2. REGISTRO PROFESIONAL (COMPLETO)                                         */
/* -------------------------------------------------------------------------- */

export async function registerProfessional(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const specialty = formData.get('specialty');
  
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');
  const coverLetter = formData.get('coverLetter'); 
  const cvFile = formData.get('cv'); 

  if (!name || !email || !password || !specialty) return { error: "Campos obligatorios incompletos." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener 8 caracteres mínimo." };

  try {
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professional.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) count++;
    slug = count === 0 ? slug : `${slug}-${count}`;

    let cvUrl = null;
    if (cvFile && cvFile.size > 0) cvUrl = `pending_upload_${Date.now()}_${cvFile.name}`;

    const hashedPassword = await bcrypt.hash(password, 12); 
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.professional.create({
      data: {
        name, email, password: hashedPassword, specialty, slug,
        phone: phone || null, bio: bio || null, coverLetter: coverLetter || null, cvUrl, 
        isApproved: false,
        emailVerified: false,
        verifyTokenHash, verifyTokenExp, verifyEmailLastSentAt: new Date(),
      }
    });

    // Enviar Email con Resend
    if (process.env.RESEND_API_KEY) {
        const verificationUrl = `${process.env.NEXT_PUBLIC_URL}/verificar-email?token=${verifyToken}`;
        await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Verifica tu cuenta profesional',
        html: `<p>Bienvenido ${name}. <a href="${verificationUrl}">Verifica tu email aquí</a>.</p>`
        });
    }

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
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
  // Recogemos otros campos si vienen en el formData
  const phone = formData.get('phone');
  const identification = formData.get('identification');
  const birthDate = formData.get('birthDate');

  if (!name || !email || !password) return { error: "Faltan datos obligatorios." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Correo ya registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Convertir fecha si existe
    let birthDateObj = null;
    if (birthDate) birthDateObj = new Date(birthDate);

    await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword,
        phone: phone || null,
        identification: identification || null,
        birthDate: birthDateObj
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrar usuario." };
  }
}