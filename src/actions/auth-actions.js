//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Resend } from 'resend';
import { signToken } from "@/lib/auth"; // Usamos tu librería centralizada

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://crm-smcr.vercel.app";

/* -------------------------------------------------------------------------- */
/* 1. LOGIN UNIFICADO (User + Profile)                                        */
/* -------------------------------------------------------------------------- */

export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) return { error: "Credenciales requeridas." };

  try {
    // 1. Buscamos en la TABLA ÚNICA de Usuarios
    // Incluimos el perfil profesional por si acaso es un médico
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { professionalProfile: true } 
    });

    // 2. Validaciones de Seguridad
    if (!user || !user.password) {
      return { error: "Credenciales inválidas." };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return { error: "Credenciales inválidas." };

    // 3. Validación de Negocio: Aprobación
    // Si es profesional y NO está aprobado, no entra.
    if (user.role === 'PROFESSIONAL' && !user.isApproved) {
      return { error: "Tu cuenta está pendiente de aprobación por la administración." };
    }

    // 4. Bloqueo de usuarios baneados (si isActive es false)
    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Contacta soporte." };
    }

    // 5. INTELIGENCIA DE NEGOCIO: Actualizar Last Login
    // Esto se ejecuta en segundo plano (sin await) para no frenar el login
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch(err => console.error("Error actualizando lastLogin:", err));

    // 6. Preparar Payload del Token
    const sessionData = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      name: user.name,
      // Datos extra útiles para el frontend
      professionalId: user.professionalProfile?.id || null,
      slug: user.professionalProfile?.slug || null
    };

    // 7. Crear Cookie (Usando tu lib/auth.js)
    const token = await signToken(sessionData);
    
    // Configurar cookie
    cookies().set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      sameSite: "lax",
      path: "/",
    });

    return { success: true, role: user.role };

  } catch (error) {
    console.error("Login error:", error);
    return { error: "Ocurrió un error inesperado." };
  }
}

export async function logout() {
  cookies().set("session", "", { expires: new Date(0) });
  redirect("/ingresar");
}

/* -------------------------------------------------------------------------- */
/* 2. REGISTRO PROFESIONAL (Transacción Atómica)                              */
/* -------------------------------------------------------------------------- */

export async function registerProfessional(formData) {
  // Datos Personales
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  
  // Datos Profesionales
  const specialty = formData.get('specialty');
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');
  const coverLetter = formData.get('coverLetter'); // Capturamos Carta
  
  // Marketing
  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo';

  // Validación básica
  if (!name || !email || !password || !specialty) return { error: "Faltan campos obligatorios." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    // Generar Slug Único (Para la URL del perfil)
    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professionalProfile.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) {
      count++;
    }
    slug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    
    // --- TRANSACCIÓN: TODO O NADA ---
    // Creamos usuario y perfil al mismo tiempo. Si falla uno, no se crea ninguno.
    await prisma.$transaction(async (tx) => {
      // A. Crear Usuario Base
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone,
          role: 'PROFESSIONAL',
          isApproved: false, // Requiere aprobación Admin
          emailVerified: false,
          verifyTokenHash: crypto.createHash('sha256').update(verifyToken).digest('hex'),
          verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
          
          acquisitionChannel: acquisitionChannel, 
          campaignName: 'Captación Profesionales'
        }
      });

      // B. Crear Perfil Profesional Enlazado
      await tx.professionalProfile.create({
        data: {
          userId: newUser.id,
          specialty,
          slug,
          bio,
          coverLetter: coverLetter || null,
          // Nota: No guardamos 'cvUrl' aún porque el archivo no se ha subido a la nube.
          // Ignoramos el objeto File aquí para no romper Prisma.
        }
      });
    });

    // Envío de Email (Fuera de la transacción para no bloquear la DB si falla el correo)
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>', // Cambia esto en producción
        to: email,
        subject: 'Confirma tu cuenta profesional',
        html: `<p>Hola ${name}, gracias por registrarte. Por favor verifica tu cuenta aquí: <a href="${BASE_URL}/verificar-email?token=${verifyToken}">Verificar Email</a></p>`
      });
    }

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. REGISTRO PACIENTE (Con Captura de Marketing)                            */
/* -------------------------------------------------------------------------- */

export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const phone = formData.get('phone');
  
  // Marketing
  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo'; 

  if (!name || !email || !password) return { error: "Datos incompletos." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'USER',
        isApproved: true, // Pacientes entran directo sin aprobación manual
        acquisitionChannel: acquisitionChannel,
        // createdAt se llena automático
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrarse." };
  }
}

/* -------------------------------------------------------------------------- */
/* 4. VERIFICACIÓN DE EMAIL                                                   */
/* -------------------------------------------------------------------------- */

export async function verifyEmail(token) {
  if (!token) return { error: "Token inválido." };

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    // Buscamos en la tabla USER (ahora es la única que tiene tokens)
    const user = await prisma.user.findFirst({
      where: { 
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: new Date() } 
      }
    });

    if (!user) return { error: "Token inválido o expirado." };

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: true,
        verifyTokenHash: null,
        verifyTokenExp: null
      }
    });

    return { success: true, role: user.role, email: user.email };

  } catch (error) {
    console.error("Error verificando email:", error);
    return { error: "Error al verificar." };
  }
}