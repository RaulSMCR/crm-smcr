// src/actions/admin-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend"; 

// URL BASE (Producción vs Local)
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

/* -------------------------------------------------------------------------- */
/* 1. GESTIÓN DE USUARIOS (APROBAR / RECHAZAR)                                */
/* -------------------------------------------------------------------------- */

export async function approveUser(userId) {
  if (!userId) return { error: "ID de usuario requerido" };

  try {
    // 1. Actualizar el estado en la base de datos
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      include: { professionalProfile: true } 
    });

    // 2. Enviar correo de notificación
    if (process.env.RESEND_API_KEY && updatedUser.email) {
      const { error } = await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: updatedUser.email,
        subject: '¡Tu perfil ha sido aprobado!',
        html: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                <h2 style="color: #1e3a8a; margin: 0;">¡Felicidades, ${updatedUser.name}!</h2>
            </div>
            <div style="padding: 20px; background-color: #ffffff;">
                <p>Tu perfil profesional ha sido revisado y <strong>aprobado</strong>.</p>
                <p>Ya eres parte oficial de la red.</p>
                <div style="text-align: center; margin: 30px 0;">
                   <a href="${BASE_URL}/ingresar" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                      Ir a mi Panel Profesional
                   </a>
                </div>
            </div>
          </div>
        `
      });
      if (error) console.error("❌ Error enviando email:", error);
    }

    revalidatePath('/panel/admin');
    return { success: true };

  } catch (error) {
    console.error("Error aprobando usuario:", error);
    return { error: "No se pudo aprobar el usuario." };
  }
}

export async function rejectUser(userId) {
    if (!userId) return { error: "ID requerido" };
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { isActive: false }
        });
        revalidatePath('/panel/admin');
        return { success: true };
    } catch (error) {
        console.error("Error rechazando usuario:", error);
        return { error: "Error al rechazar usuario" };
    }
}

/* -------------------------------------------------------------------------- */
/* 2. GESTIÓN DE SERVICIOS (CATÁLOGO GLOBAL)                                  */
/* -------------------------------------------------------------------------- */

export async function createService(formData) {
  const title = formData.get('title');
  const price = formData.get('price');
  const duration = formData.get('duration');

  if (!title || !price) return { error: "Título y precio requeridos" };

  try {
    await prisma.service.create({
      data: {
        title,
        price: parseFloat(price),
        durationMin: parseInt(duration) || 60,
        isActive: true,
        // Description es opcional, si viene en el form lo usamos
        description: formData.get('description') || "Servicio profesional estándar."
      }
    });
    revalidatePath('/panel/admin/servicios');
    return { success: true };
  } catch (error) {
    console.error("Error creando servicio:", error);
    return { error: "Error creando servicio" };
  }
}

export async function toggleServiceStatus(serviceId, isActive) {
  try {
    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: isActive }
    });
    revalidatePath('/panel/admin/servicios');
    // También revalidamos el perfil del profesional porque la lista de opciones cambia
    revalidatePath('/panel/profesional/perfil'); 
    return { success: true };
  } catch (error) {
    return { error: "Error actualizando servicio" };
  }
}

export async function deleteService(serviceId) {
    try {
        await prisma.service.delete({ where: { id: serviceId }});
        revalidatePath('/panel/admin/servicios');
        return { success: true };
    } catch (e) {
        // Si hay profesionales ligados a este servicio, Prisma lanzará error
        return { error: "No se puede borrar: Hay profesionales usando este servicio. Desactívalo en su lugar." };
    }
}

/* -------------------------------------------------------------------------- */
/* 3. GESTIÓN EDITORIAL (BLOG)                                                */
/* -------------------------------------------------------------------------- */

export async function updatePostStatus(postId, newStatus) {
    // newStatus esperamos que sea 'PUBLISHED' o 'DRAFT'
    try {
        const isPublished = newStatus === 'PUBLISHED';
        
        await prisma.post.update({
            where: { id: postId },
            data: { published: isPublished }
        });
        
        revalidatePath('/panel/admin/blog');
        return { success: true };
    } catch (error) {
        console.error("Error actualizando post:", error);
        return { error: "Error actualizando post" };
    }
}