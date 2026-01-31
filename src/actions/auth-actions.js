//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import crypto from "crypto"; // Necesario para generar tokens de seguridad

// Configuración de clave secreta para la sesión
const secretKey = process.env.JWT_SECRET || "secret-key-change-me-in-prod";
const key = new TextEncoder().encode(secretKey);

/**
 * 1. OBTENER SESIÓN (getSession)
 * Verifica la cookie, valida la firma JWT y devuelve los datos del usuario.
 */
export async function getSession() {
  const cookieStore = cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    // Si el token es inválido o expiró, retornamos null
    return null;
  }
}

/**
 * 2. INICIAR SESIÓN (Login)
 * Unificado para Profesionales y Pacientes.
 */
export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) return { error: "Por favor, ingresa tus credenciales." };

  // A. Buscar usuario (Primero en Profesionales, luego en Usuarios)
  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  // Si no existe en ninguna tabla
  if (!user) {
    return { error: "Credenciales inválidas." };
  }

  // B. Verificar contraseña (Bcrypt)
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    return { error: "Credenciales inválidas." };
  }

  // C. (Opcional) Verificar si el profesional está aprobado
  // Si quieres bloquear el login hasta que sea aprobado, descomenta esto:
  /*
  if (role === 'PROFESSIONAL' && !user.isApproved) {
    return { error: "Tu cuenta está pendiente de aprobación." };
  }
  */

  // D. Crear Token de Sesión
  const sessionData = {
    userId: user.id,
    email: user.email,
    role: role,
    user: { name: user.name }, 
    profile: user // Datos completos para usar en el frontend
  };

  // Caducidad: 7 días
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

  const session = await new SignJWT(sessionData)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  // E. Establecer Cookie Segura
  cookies().set("session", session, {
    httpOnly: true, // No accesible por JS del cliente (seguridad XSS)
    secure: process.env.NODE_ENV === "production", // Solo HTTPS en producción
    expires,
    sameSite: "lax",
    path: "/",
  });

  return { success: true, role };
}

/**
 * 3. CERRAR SESIÓN (Logout)
 */
export async function logout() {
  cookies().set("session", "", { expires: new Date(0) });
  redirect("/ingresar");
}

/**
 * 4. REGISTRO PROFESIONAL ROBUSTO
 * Incluye generación de slug, hash de contraseña y tokens de verificación.
 */
export async function registerProfessional(formData) {
  // Recolección de datos
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const specialty = formData.get('specialty');
  
  // Datos del Perfil Completo
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');
  const coverLetter = formData.get('coverLetter'); 
  const cvFile = formData.get('cv'); 

  // Validaciones
  if (!name || !email || !password || !specialty) {
    return { error: "Nombre, Email, Contraseña y Especialidad son obligatorios." };
  }

  try {
    // A. Verificar duplicados
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo electrónico ya está registrado." };

    // B. Generar Slug Único (Para la URL del perfil público)
    let slug = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-');
      
    let count = 0;
    while (true) {
      const slugToCheck = count === 0 ? slug : `${slug}-${count}`;
      const check = await prisma.professional.findUnique({ where: { slug: slugToCheck } });
      if (!check) {
        slug = slugToCheck;
        break;
      }
      count++;
    }

    // C. Manejo del Archivo CV (Simulación segura)
    // Guardamos el nombre del archivo como referencia hasta implementar subida a la nube.
    let cvUrl = null;
    if (cvFile && cvFile.size > 0) {
      cvUrl = `pending_upload_${Date.now()}_${cvFile.name}`;
    }

    // D. Seguridad: Hash de Contraseña
    const hashedPassword = await bcrypt.hash(password, 12); // Salt 12

    // E. Seguridad: Tokens de Verificación (Email Verification)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expira en 24hs

    // F. Crear en Base de Datos
    await prisma.professional.create({
      data: {
        // Datos básicos
        name,
        email,
        password: hashedPassword,
        specialty,
        slug,
        
        // Perfil extendido
        phone: phone || null,
        bio: bio || null,
        coverLetter: coverLetter || null,
        cvUrl: cvUrl, 

        // Seguridad y Estado
        isApproved: false, // Requiere aprobación manual del admin
        emailVerified: false,
        verifyTokenHash,
        verifyTokenExp,
        verifyEmailLastSentAt: new Date(),
      }
    });

    // TODO: Aquí dispararíamos el email de verificación usando 'resend' con el 'verifyToken'

    return { success: true };

  } catch (error) {
    console.error("Error crítico en registro profesional:", error);
    return { error: "Error interno del sistema al procesar el registro." };
  }
}

/**
 * 5. REGISTRO DE USUARIO (PACIENTE)
 */
export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');

  if (!name || !email || !password) return { error: "Todos los campos son obligatorios." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Correo ya registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);

    // Opcional: Generar token de verificación también para usuarios
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword,
        // Si tienes campos de verificación en User, descomenta esto:
        // verifyTokenHash, 
        // emailVerified: false 
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrar usuario." };
  }
}