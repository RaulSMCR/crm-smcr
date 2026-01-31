//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

// Clave secreta para firmar los tokens (en producción debe estar en .env)
const secretKey = process.env.JWT_SECRET || "secret-key-change-me-in-prod";
const key = new TextEncoder().encode(secretKey);

/**
 * 1. OBTENER SESIÓN (getSession)
 * Verifica la cookie y devuelve el usuario si está logueado.
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
    return null;
  }
}

/**
 * 2. INICIAR SESIÓN (Login)
 */
export async function login(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  // 1. Buscar usuario (Puede ser Profesional o Paciente/User)
  // Primero buscamos como Profesional
  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  // Si no es profesional, buscamos como Paciente
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  // Si no existe ninguno
  if (!user) {
    return { error: "Credenciales inválidas." };
  }

  // 2. Verificar contraseña
  // Nota: Asegúrate de que tu DB use nombres consistentes. 
  // Si en Prisma es 'password', usa 'password'. Si es 'passwordHash', ajusta aquí.
  // Asumimos 'password' por tu schema reciente.
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    return { error: "Credenciales inválidas." };
  }

  // 3. Crear la Sesión (Token)
  // Guardamos info mínima en la cookie
  const sessionData = {
    userId: user.id,
    email: user.email,
    role: role,
    user: { name: user.name }, // Datos básicos para la UI
    profile: user // Datos completos (útil para perfiles)
  };

  // Caducidad: 7 días
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

  const session = await new SignJWT(sessionData)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);

  // 4. Establecer Cookie
  cookies().set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
 * 4. REGISTRO PROFESIONAL
 */
export async function registerProfessional(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const specialty = formData.get('specialty');

  if (!name || !email || !password || !specialty) {
    return { error: "Todos los campos son obligatorios." };
  }

  try {
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    // Generar Slug
    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professional.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) {
      count++;
    }
    const finalSlug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.professional.create({
      data: {
        name,
        email,
        password: hashedPassword,
        specialty,
        slug: finalSlug,
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error interno al registrar." };
  }
}

/**
 * 5. REGISTRO PACIENTE (Usuario)
 * (Lo agregamos por si acaso lo necesitas en el futuro inmediato)
 */
export async function registerUser(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');

  if (!name || !email || !password) return { error: "Faltan datos." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "Correo ya registrado." };

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { name, email, password: hashedPassword }
    });

    return { success: true };
  } catch (error) {
    return { error: "Error al registrar usuario." };
  }
}