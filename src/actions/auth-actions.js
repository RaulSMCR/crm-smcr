// PATH: src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache"; // <--- IMPORTANTE PARA EL 404
import crypto from "crypto";
import { resend } from "@/lib/resend"; 
import { signToken, getSession as getLibSession } from "@/lib/auth"; 

// URL BASE
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

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

    if (user.role === 'PROFESSIONAL' && !user.isApproved) {
      return { error: "Tu cuenta está pendiente de aprobación por la administración." };
    }

    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Contacta soporte." };
    }

    await prisma.user.update({
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
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      sameSite: "lax",
      path: "/",
    });

    return { success: true, role: user.role };

  } catch (error) {
    console.error("Login error:", error);
    return { error: "Ocurrió un error inesperado." };
  }
}

/* -------------------------------------------------------------------------- */
/* 2. REGISTRO PROFESIONAL                                                    */
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
  const cvUrl = formData.get('cvUrl'); 
  const licenseNumber = formData.get('licenseNumber');

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
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    
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
          verifyTokenHash: verifyTokenHash,
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
          cvUrl: cvUrl || null,
          licenseNumber: licenseNumber || "Pendiente",
        }
      });
    });

    if (!process.env.RESEND_API_KEY) {
      console.error("⚠️ RESEND_API_KEY no configurada.");
    } else {
      const { error } = await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Recibimos tu solicitud profesional',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Hola ${name},</h2>
            <p>Hemos recibido tu solicitud y tu CV correctamente.</p>
            <p>Por favor confirma tu correo para continuar:</p>
            <p>
                <a href="${BASE_URL}/verificar-email?token=${verifyToken}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Verificar Email
                </a>
            </p>
          </div>
        `
      });

      if (error) console.error("❌ Error enviando email a Profesional:", error);
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
  const confirmPassword = formData.get('confirmPassword');
  const phone = formData.get('phone');
  const acquisitionChannel = formData.get('acquisitionChannel') || 'Directo'; 

  if (!name || !email || !password) return { error: "Datos incompletos." };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'USER',
        isApproved: true, 
        emailVerified: false,
        verifyTokenHash,
        verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
        acquisitionChannel,
      }
    });

    if (!process.env.RESEND_API_KEY) {
      console.error("⚠️ RESEND_API_KEY no configurada.");
    } else {
      const { data, error } = await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: email,
        subject: 'Bienvenido a SMCR - Confirma tu cuenta',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>¡Bienvenido, ${name}!</h2>
            <p>Gracias por unirte a nuestra comunidad.</p>
            <p>Para activar tu cuenta, confirma tu correo:</p>
            <p>
                <a href="${BASE_URL}/verificar-email?token=${verifyToken}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Verificar mi Email
                </a>
            </p>
          </div>
        `
      });

      if (error) {
        console.error("❌ RESEND API ERROR:", error);
      } else {
        console.log("✅ Email enviado a:", email, "ID:", data?.id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error FATAL registro usuario:", error);
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

/* -------------------------------------------------------------------------- */
/* 5. LOGOUT (CORREGIDO PARA EVITAR 404)                                      */
/* -------------------------------------------------------------------------- */
export async function logout() {
  try {
    // Intentamos borrar la cookie de sesión
    cookies().delete("session");
  } catch (error) {
    console.error("Error al borrar cookie en logout (no crítico):", error);
  }

  // Limpiamos caché de Next.js para asegurar que el middleware no lea datos viejos
  revalidatePath("/", "layout");

  // Redirección fuera del Try/Catch
  redirect("/ingresar");
}