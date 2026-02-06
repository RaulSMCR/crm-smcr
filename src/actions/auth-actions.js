//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Resend } from 'resend';
// 👇 IMPORTANTE: Importamos getSession de la librería (la fuente de la verdad)
import { signToken, getSession as getLibSession } from "@/lib/auth"; 

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://crm-smcr.vercel.app";

/* -------------------------------------------------------------------------- */
/* 0. UTILIDADES DE SESIÓN (PUENTE)                                           */
/* -------------------------------------------------------------------------- */

// Mantenemos esto para que las páginas que importan desde aquí sigan funcionando
export async function getSession() {
  return await getLibSession();
}

/* -------------------------------------------------------------------------- */
/* 1. LOGIN UNIFICADO (User + Profile)                                        */
/* -------------------------------------------------------------------------- */

export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) return { error: "Credenciales requeridas." };

  try {
    // 1. Buscamos en la TABLA ÚNICA de Usuarios
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
    if (user.role === 'PROFESSIONAL' && !user.isApproved) {
      return { error: "Tu cuenta está pendiente de aprobación por la administración." };
    }

    // 4. Bloqueo de usuarios baneados
    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Contacta soporte." };
    }

    // 5. Actualizar Last Login (Segundo plano)
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
      // Guardamos IDs clave para no tener que consultarlos luego
      professionalId: user.professionalProfile?.id || null,
      slug: user.professionalProfile?.slug || null
    };

    // 7. Crear Cookie
    const token = await signToken(sessionData);
    
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
  // 👇 CORRECCIÓN: Añadido path: '/' para asegurar borrado
  cookies().set("session", "", { expires: new Date(0), path: '/' });
  redirect("/ingresar");
}

/* -------------------------------------------------------------------------- */
/* 2. REGISTRO PROFESIONAL (Transacción Atómica)                              */
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
  
  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo';

  if (!name || !email || !password || !specialty) return { error: "Faltan campos obligatorios." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professionalProfile.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) {
      count++;
    }
    slug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    
    // Transacción: Crea Usuario + Perfil o falla todo
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone,
          role: 'PROFESSIONAL',
          isApproved: false,
          emailVerified: false,
          verifyTokenHash: crypto.createHash('sha256').update(verifyToken).digest('hex'),
          verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
          acquisitionChannel: acquisitionChannel, 
          campaignName: 'Captación Profesionales'
        }
      });

      await tx.professionalProfile.create({
        data: {
          userId: newUser.id,
          specialty,
          slug,
          bio,
          coverLetter: coverLetter || null,
        }
      });
    });

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Confirma tu cuenta profesional',
        html: `<p>Hola ${name}, verifica tu cuenta aquí: <a href="${BASE_URL}/verificar-email?token=${verifyToken}">Verificar Email</a></p>`
      });
    }

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. REGISTRO PACIENTE                                                       */
/* -------------------------------------------------------------------------- */

export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const phone = formData.get('phone');
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
        isApproved: true,
        acquisitionChannel: acquisitionChannel,
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