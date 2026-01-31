//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import crypto from "crypto"; 

// Configuración de clave secreta para la sesión
const secretKey = process.env.JWT_SECRET || "secret-key-change-me-in-prod";
const key = new TextEncoder().encode(secretKey);

/* -------------------------------------------------------------------------- */
/* 1. SESIÓN                                   */
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

  // Buscar usuario (Profesional o Paciente)
  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Credenciales inválidas." };
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
/* 2. REGISTRO PROFESIONAL                             */
/* -------------------------------------------------------------------------- */

export async function registerProfessional(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const specialty = formData.get('specialty');
  
  // Datos del Perfil y Adjuntos
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');
  const coverLetter = formData.get('coverLetter'); 
  const cvFile = formData.get('cv'); 

  // --- 1. Validaciones ---
  if (!name || !email || !password || !specialty) {
    return { error: "Todos los campos marcados con * son obligatorios." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  // Validación de complejidad (opcional, recomendada)
  const hasNumber = /\d/.test(password);
  if (!hasNumber) return { error: "La contraseña debe incluir al menos un número." };

  try {
    // --- 2. Verificar Duplicados ---
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    // --- 3. Generar Slug Único ---
    let slug = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-');
      
    let count = 0;
    while (true) {
      const slugToCheck = count === 0 ? slug : `${slug}-${count}`;
      const check = await prisma.professional.findUnique({ where: { slug: slugToCheck } });
      if (!check) { slug = slugToCheck; break; }
      count++;
    }

    // --- 4. Manejo de Archivo (Simulación) ---
    let cvUrl = null;
    if (cvFile && cvFile.size > 0) {
      cvUrl = `pending_upload_${Date.now()}_${cvFile.name}`;
    }

    // --- 5. Hash y Seguridad ---
    const hashedPassword = await bcrypt.hash(password, 12); 
    
    // Tokens de verificación
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // --- 6. Crear en DB ---
    await prisma.professional.create({
      data: {
        name,
        email,
        password: hashedPassword,
        specialty,
        slug,
        phone: phone || null,
        bio: bio || null,
        coverLetter: coverLetter || null,
        cvUrl: cvUrl, 
        
        // Estado inicial
        isApproved: false, 
        emailVerified: false,
        verifyTokenHash,
        verifyTokenExp,
        verifyEmailLastSentAt: new Date(),
      }
    });

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error interno del sistema." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. REGISTRO USUARIO                                 */
/* -------------------------------------------------------------------------- */

export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');

  if (!name || !email || !password) return { error: "Faltan datos." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Correo ya registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, password: hashedPassword } });

    return { success: true };
  } catch (error) {
    return { error: "Error al registrar usuario." };
  }
}