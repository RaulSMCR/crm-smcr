"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { getSession } from "@/lib/auth";
import { SITE_URL as BASE_URL } from "@/lib/site-url";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

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
      data: { isActive: false, sessionVersion: { increment: 1 } },
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

    const post = await prisma.post.update({
      where: { id: String(postId) },
      data: { status: String(newStatus) },
      select: { slug: true },
    });

    revalidatePath("/panel/admin/blog");
    revalidatePath(`/panel/admin/blog/${postId}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/"); // la home lista los artículos publicados
    return { success: true };
  } catch (error) {
    console.error("Error actualizando post:", error);
    return { error: "Error actualizando post" };
  }
}

export async function updateAdminPost(postInput) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const id = String(postInput?.id || "");
    const title = String(postInput?.title || "").trim();
    const content = String(postInput?.content || "").trim();
    const slug = slugify(postInput?.slug || title);
    const excerpt = String(postInput?.excerpt || "").trim() || null;
    const coverImage = String(postInput?.coverImage || "").trim() || null;
    const coverImageTitle = String(postInput?.coverImageTitle || "").trim() || null;
    const coverImageAuthor = String(postInput?.coverImageAuthor || "").trim() || null;
    const coverImageNote = String(postInput?.coverImageNote || "").trim() || null;
    const coverImageFocusX = clampInt(postInput?.coverImageFocusX, 0, 100, 50);
    const coverImageFocusY = clampInt(postInput?.coverImageFocusY, 0, 100, 50);
    const coverImageScale = clampInt(postInput?.coverImageScale, 100, 180, 100);

    if (!id) return { error: "ID de articulo requerido." };
    if (title.length < 4) return { error: "El titulo debe tener al menos 4 caracteres." };
    if (content.length < 20) return { error: "El contenido debe tener al menos 20 caracteres." };
    if (!slug) return { error: "El slug no puede quedar vacio." };

    const existingSlug = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug && existingSlug.id !== id) {
      return { error: "Ya existe otro articulo con ese slug." };
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImage,
        coverImageTitle,
        coverImageAuthor,
        coverImageNote,
        coverImageFocusX,
        coverImageFocusY,
        coverImageScale,
      },
      select: { slug: true },
    });

    revalidatePath("/panel/admin/blog");
    revalidatePath(`/panel/admin/blog/${id}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/"); // la home lista los artículos publicados

    return { success: true };
  } catch (error) {
    console.error("Error editando post admin:", error);
    return { error: "No se pudo guardar el articulo." };
  }
}
