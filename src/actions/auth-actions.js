//src/actions/auth-actions.js
// src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Resend } from 'resend';
import { signToken, getSession as getLibSession } from "@/lib/auth"; 

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://crm-smcr.vercel.app";

/* -------------------------------------------------------------------------- */
/* 0. UTILIDADES DE SESIÓN                                                    */
/* -------------------------------------------------------------------------- */

export async function getSession() {
  return await getLibSession();
}

/* -------------------------------------------------------------------------- */
/* 1. LOGIN UNIFICADO                                                         */
/* -------------------------------------------------------------------------- */

export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) return { error: "Credenciales requeridas." };

  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { professionalProfile: true } 
    });

    if (!user || !user.password) {
      return { error: "Credenciales inválidas." };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return { error: "Credenciales inválidas." };

    // Validación de Negocio: Aprobación Profesional
    if (user.role === 'PROFESSIONAL' && !user.isApproved) {
      return { error: "Tu cuenta está pendiente de aprobación por la administración." };
    }

    // Bloqueo de usuarios
    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Contacta soporte." };
    }

    // Actualizar Last Login
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch(err => console.error("Error actualizando lastLogin:", err));

    const sessionData = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      name: user.name,
      professionalId: user.professionalProfile?.id || null,
      slug: user.professionalProfile?.slug || null
    };

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
  cookies().set("session", "", { expires: new Date(0), path: '/' });
  redirect("/ingresar");
}

/* -------------------------------------------------------------------------- */
/* 2. REGISTRO PROFESIONAL (Con CV, Matrícula y Email)                        */
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
  
  // 👇 DATOS CRÍTICOS RECUPERADOS DEL FORMULARIO
  const cvUrl = formData.get('cvUrl'); 
  const licenseNumber = formData.get('licenseNumber');

  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo';

  if (!name || !email || !password || !specialty) return { error: "Faltan campos obligatorios." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    // Generar Slug único
    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professionalProfile.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) {
      count++;
    }
    slug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    
    // Transacción: Crea Usuario + Perfil (Con CV y Matrícula)
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone,
          role: 'PROFESSIONAL',
          isApproved: false, // Requiere aprobación manual
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
          // 👇 GUARDADO DE CV Y MATRÍCULA
          cvUrl: cvUrl || null,
          licenseNumber: licenseNumber || "Pendiente",
        }
      });
    });

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Recibimos tu solicitud profesional',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Hola ${name},</h2>
            <p>Hemos recibido tu solicitud y tu CV correctamente.</p>
            <p>Mientras nuestro equipo administrativo revisa tu perfil, por favor <strong>verifica tu correo electrónico</strong>:</p>
            <p>
                <a href="${BASE_URL}/verificar-email?token=${verifyToken}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Verificar Email
                </a>
            </p>
            <p><small>Si no solicitaste esto, ignora este mensaje.</small></p>
          </div>
        `
      });
    }

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. REGISTRO PACIENTE (Con Token y Email de Verificación)                   */
/* -------------------------------------------------------------------------- */

export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword'); // 👇 Validamos confirmación
  const phone = formData.get('phone');
  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo'; 

  // 1. Validaciones
  if (!name || !email || !password) return { error: "Datos incompletos." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 2. Generar Token (Igual que Pro)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    // 3. Crear Usuario (Paciente)
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'USER',
        isApproved: true, // Pacientes entran directos (pero verifican email)
        emailVerified: false,
        verifyTokenHash,
        verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
        acquisitionChannel,
      }
    });

    // 4. Enviar Correo Paciente
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Bienvenido a SMCR - Confirma tu cuenta',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>¡Bienvenido, ${name}!</h2>
            <p>Gracias por unirte a nuestra comunidad.</p>
            <p>Para activar todas las funciones de tu cuenta, por favor confirma tu correo:</p>
            <p>
                <a href="${BASE_URL}/verificar-email?token=${verifyToken}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Verificar mi Email
                </a>
            </p>
          </div>
        `
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrarse. Inténtalo de nuevo." };
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