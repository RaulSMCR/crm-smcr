// src/actions/admin-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend"; 

export async function approveUser(userId) {
  if (!userId) return { error: "ID de usuario requerido" };

  try {
    // 1. Actualizar el estado en la base de datos
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      include: { professionalProfile: true } // Traemos el perfil para tener el nombre/email
    });

    // 2. (Opcional) Enviar correo de notificación al profesional
    if (process.env.RESEND_API_KEY && updatedUser.email) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: updatedUser.email,
        subject: '¡Tu perfil ha sido aprobado!',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>¡Felicidades, ${updatedUser.name}!</h2>
            <p>Tu perfil profesional ha sido revisado y <strong>aprobado</strong> por nuestra administración.</p>
            <p>Ya puedes acceder a tu panel y gestionar tu agenda:</p>
            <p>
               <a href="${process.env.NEXT_PUBLIC_URL}/ingresar" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Ir a mi Panel
               </a>
            </p>
          </div>
        `
      }).catch(err => console.error("Error enviando email de aprobación:", err));
    }

    // 3. Refrescar la caché para que la lista de pendientes se actualice sola
    revalidatePath('/panel/admin');
    
    return { success: true };

  } catch (error) {
    console.error("Error aprobando usuario:", error);
    return { error: "No se pudo aprobar el usuario. Intenta de nuevo." };
  }
}

export async function rejectUser(userId) {
    if (!userId) return { error: "ID requerido" };
    try {
        // Opción A: Borrar usuario
        // await prisma.user.delete({ where: { id: userId } });
        
        // Opción B: Marcar como desactivado (Mejor para historial)
        await prisma.user.update({
            where: { id: userId },
            data: { isActive: false }
        });

        revalidatePath('/panel/admin');
        return { success: true };
    } catch (error) {
        return { error: "Error al rechazar usuario" };
    }
}