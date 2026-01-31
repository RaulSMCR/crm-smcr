//src/actions/auth-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

// Helper simple para crear slugs
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function registerProfessional(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const specialty = formData.get('specialty'); // <--- IMPORTANTE: El form debe enviar este nombre

  if (!name || !email || !password || !specialty) {
    return { error: "Todos los campos son obligatorios." };
  }

  try {
    // 1. Verificar si el email ya existe
    const existingUser = await prisma.professional.findUnique({
      where: { email }
    });

    if (existingUser) {
      return { error: "Este correo electrónico ya está registrado." };
    }

    // 2. Generar Slug único
    let slug = generateSlug(name);
    // Verificar si el slug existe y agregarle un número si es necesario
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

    // 3. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Crear el Profesional (Con el schema NUEVO)
    await prisma.professional.create({
      data: {
        name,
        email,
        password: hashedPassword,
        specialty, // Usamos specialty, NO declaredJobTitle
        slug,      // El slug es obligatorio
        // isApproved: true // Opcional: Si quieres aprobarlos automáticamente, descomenta esto si agregaste el campo de nuevo, si no, bórralo.
      }
    });

    // 5. Redirigir al login
    // No usamos redirect() dentro del try/catch si queremos devolver datos, 
    // pero para un registro exitoso está bien retornar success.
    return { success: true };

  } catch (error) {
    console.error("Error en registro profesional:", error);
    return { error: "Error interno al procesar el registro." };
  }
}

// ... (Mantén aquí tus otras funciones como login, getSession, logout)