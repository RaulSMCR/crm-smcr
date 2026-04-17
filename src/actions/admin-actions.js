"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { getSession } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_URL || "https://saludmentalcostarica.com";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

export async function approveUser(userId) {
  if (!userId) return { error: "ID de usuario requerido" };

  try {
    const session = await getSession();
    requireAdmin(session);

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      include: { professionalProfile: true },
    });

    if (!user) return { error: "Usuario no encontrado." };
    if (user.role !== "PROFESSIONAL") return { error: "El usuario no es profesional." };
    if (!user.professionalProfile) return { error: "El profesional no tiene perfil profesional." };

    await prisma.professionalProfile.update({
      where: { id: user.professionalProfile.id },
      data: { isApproved: true },
    });

    await prisma.user.update({
      where: { id: String(userId) },
      data: { isActive: true },
    });

    if (process.env.RESEND_API_KEY && user.email) {
      await resend.emails.send({
        from: "Salud Mental Costa Rica <no-reply@saludmentalcostarica.com>",
        to: user.email,
        subject: "Perfil aprobado con éxito",
        html: `
          <div style="font-family: sans-serif; text-align: center;">
            <h2>Felicidades, ${user.name}!</h2>
            <p>El perfil profesional ha sido aprobado con éxito.</p>
            <a href="${BASE_URL}/ingresar" style="background: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Ir al Panel
            </a>
          </div>
        `,
      });
    }

    revalidatePath("/panel/admin");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/profesional");
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional/horarios");

    return { success: true };
  } catch (error) {
    console.error("Error aprobando usuario:", error);
    return { error: "No se pudo aprobar el usuario." };
  }
}

export async function rejectUser(userId) {
  if (!userId) return { error: "ID requerido" };

  try {
    const session = await getSession();
    requireAdmin(session);

    await prisma.user.update({
      where: { id: String(userId) },
      data: { isActive: false },
    });

    revalidatePath("/panel/admin");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/profesional");
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional/horarios");

    return { success: true };
  } catch (error) {
    console.error("Error rechazando usuario:", error);
    return { error: "Error al rechazar usuario" };
  }
}

export async function updatePostStatus(postId, newStatus) {
  try {
    const session = await getSession();
    requireAdmin(session);

    await prisma.post.update({
      where: { id: String(postId) },
      data: { status: String(newStatus) },
    });

    revalidatePath("/panel/admin/blog");
    return { success: true };
  } catch (error) {
    console.error("Error actualizando post:", error);
    return { error: "Error actualizando post" };
  }
}
