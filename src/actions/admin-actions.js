// src/actions/admin-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ... (tus otras funciones createService, approveUser, etc.)

export async function rejectUser(userId) {
  try {
    // 1. Buscar al usuario para obtener su email antes de borrarlo
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return { error: "Usuario no encontrado" };

    // 2. Enviar correo de rechazo (Si tienes API Key configurada)
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
        to: user.email,
        subject: 'Actualización sobre tu solicitud de registro',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #e53e3e;">Solicitud no aprobada</h2>
            <p>Hola ${user.name},</p>
            <p>Gracias por tu interés en formar parte de nuestra red de profesionales.</p>
            <p>Tras revisar tu perfil y la documentación adjunta, hemos determinado que <strong>tu solicitud no cumple con los requisitos actuales</strong> para ser aprobada en nuestra plataforma.</p>
            <p>Si crees que esto es un error o deseas volver a intentarlo con documentación actualizada, puedes registrarte nuevamente.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Equipo Administrativo - SMCR</p>
          </div>
        `
      });
    }

    // 3. Eliminar al usuario y su perfil asociado
    // Al borrar el User, Prisma borrará el ProfessionalProfile por el "onDelete: Cascade"
    await prisma.user.delete({
      where: { id: userId }
    });

    revalidatePath('/panel/admin');
    return { success: true };

  } catch (error) {
    console.error("Error rechazando usuario:", error);
    return { error: "Error al rechazar el usuario." };
  }
}