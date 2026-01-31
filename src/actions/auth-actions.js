//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

// Configuración JWT
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

  if (!email || !password) return { error: "Faltan credenciales." };

  // 1. Buscar usuario (Primero como Profesional, luego como Paciente)
  let user = await prisma.professional.findUnique({ where: { email } });
  let role = "PROFESSIONAL";

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    role = "USER";
  }

  if (!user) {
    return { error: "Credenciales inválidas." };
  }

  // 2. Verificar contraseña
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    return { error: "Credenciales inválidas." };
  }

  // 3. Crear Token de Sesión
  // Guardamos datos útiles en el payload para evitar consultas extra a la DB
  const sessionData = {
    userId: user.id,
    email: user.email,
    role: role,
    user: { name: user.name }, 
    profile: user // Datos completos (útil para verificar estado, avatar, etc.)
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
 * 4. REGISTRO PROFESIONAL (Con Slug, Teléfono y Bio)
 */
export async function registerProfessional(formData) {
  // Recibir datos del formulario "rico"
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const specialty = formData.get('specialty');
  const phone = formData.get('phone'); 
  const bio = formData.get('bio');    

  // Validaciones básicas
  if (!name || !email || !password || !specialty) {
    return { error: "Los campos Nombre, Email, Contraseña y Especialidad son obligatorios." };
  }

  try {
    // 1. Verificar duplicados
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    // 2. Generar Slug único
    let slug = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-');
      
    let count = 0;
    // Loop para asegurar que el slug sea único (ej: juan-perez, juan-perez-1)
    while (true) {
      const slugToCheck = count === 0 ? slug : `${slug}-${count}`;
      const check = await prisma.professional.findUnique({ where: { slug: slugToCheck } });
      if (!check) {
        slug = slugToCheck;
        break;
      }
      count++;
    }

    // 3. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Crear en Base de Datos
    await prisma.professional.create({
      data: {
        name,
        email,
        password: hashedPassword,
        specialty,
        slug,
        phone: phone || null,
        bio: bio || null,
        // isApproved: false // Por defecto es false en el schema, no hace falta ponerlo
      }
    });

    return { success: true };

  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error interno al procesar el registro." };
  }
}

/**
 * 5. REGISTRO PACIENTE (Usuario)
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

    await prisma.user.create({
      data: { name, email, password: hashedPassword }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro usuario:", error);
    return { error: "Error al registrar usuario." };
  }
}