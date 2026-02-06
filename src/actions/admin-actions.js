// src/actions/admin-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend"; 

// 👇 DEFINICIÓN DE URL BASE (Igual que en auth-actions, forzando producción)
const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

/* -------------------------------------------------------------------------- */
/* 1. APROBAR USUARIO (PROFESIONAL)                                           */
/* -------------------------------------------------------------------------- */

export async function approveUser(userId) {
  if (!userId) return { error: "ID de usuario requerido" };

  try {
    // 1. Actualizar el estado en la base de datos
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      include: { professionalProfile: true } // Traemos el perfil para personalizar el email
    });

    // 2. Enviar correo de notificación al profesional
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
                <p style="font-size: 16px; line-height: 1.5;">
                    Nos complace informarte que tu perfil profesional ha sido revisado y <strong>aprobado</strong> por nuestra administración.
                </p>
                <p style="font-size: 16px; line-height: 1.5;">
                    Ya eres parte oficial de la red. Ahora puedes acceder a tu panel para configurar tu agenda y comenzar a recibir pacientes.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                   <a href="${BASE_URL}/ingresar" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Ir a mi Panel Profesional
                   </a>
                </div>
                
                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    Si el botón no funciona, copia este enlace: <br/>
                    <a href="${BASE_URL}/ingresar" style="color: #2563EB;">${BASE_URL}/ingresar</a>
                </p>
            </div>
          </div>
        `
      });

      if (error) console.error("❌ Error enviando email de aprobación:", error);
    }

    // 3. Refrescar la caché para que la lista de pendientes se actualice sola
    revalidatePath('/panel/admin');
    
    return { success: true };

  } catch (error) {
    console.error("Error aprobando usuario:", error);
    return { error: "No se pudo aprobar el usuario. Intenta de nuevo." };
  }
}

/* -------------------------------------------------------------------------- */
/* 2. RECHAZAR USUARIO                                                        */
/* -------------------------------------------------------------------------- */

export async function rejectUser(userId) {
    if (!userId) return { error: "ID requerido" };
    try {
        // Opción: Marcar como desactivado en lugar de borrar para mantener historial
        // Si prefieres borrarlo físicamente, usa prisma.user.delete
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