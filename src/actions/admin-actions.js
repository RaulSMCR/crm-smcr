//src/actions/admin-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend"; 

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

/* -------------------------------------------------------------------------- */
/* 1. GESTIÓN DE USUARIOS                                                     */
/* -------------------------------------------------------------------------- */

export async function approveUser(userId) {
  if (!userId) return { error: "ID de usuario requerido" };

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      include: { professionalProfile: true } 
    });

    if (process.env.RESEND_API_KEY && updatedUser.email) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: updatedUser.email,
        subject: '¡Tu perfil ha sido aprobado!',
        html: `
          <div style="font-family: sans-serif; text-align: center;">
            <h2>¡Felicidades, ${updatedUser.name}!</h2>
            <p>Tu perfil ha sido aprobado.</p>
            <a href="${BASE_URL}/ingresar" style="background: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Ir al Panel
            </a>
          </div>
        `
      });
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
        revalidatePath('/panel/admin/personal'); // Refrescar lista de personal
        return { success: true };
    } catch (error) {
        return { error: "Error al rechazar usuario" };
    }
}

/* -------------------------------------------------------------------------- */
/* 2. GESTIÓN DE SERVICIOS                                                    */
/* -------------------------------------------------------------------------- */
// Estas acciones son complementarias a service-actions.js

export async function toggleServiceStatus(serviceId, isActive) {
  try {
    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: isActive }
    });
    revalidatePath('/panel/admin/servicios');
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
        return { error: "No se puede borrar el servicio." };
    }
}

/* -------------------------------------------------------------------------- */
/* 3. GESTIÓN EDITORIAL (BLOG) - CORREGIDO                                    */
/* -------------------------------------------------------------------------- */

export async function updatePostStatus(postId, newStatus) {
    // CORRECCIÓN: newStatus debe ser 'PUBLISHED' o 'DRAFT' (Strings del Enum)
    try {
        await prisma.post.update({
            where: { id: postId },
            data: { status: newStatus } // Usamos status, no published
        });
        
        revalidatePath('/panel/admin/blog');
        return { success: true };
    } catch (error) {
        console.error("Error actualizando post:", error);
        return { error: "Error actualizando post" };
    }
}