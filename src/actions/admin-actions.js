"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { getSession } from "@/lib/auth";
import { SITE_URL as BASE_URL } from "@/lib/site-url";
import { slugify, slugUnico } from "@/lib/slug";


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

    const perfil = await prisma.professionalProfile.update({
      where: { id: user.professionalProfile.id },
      data: { isApproved: true },
      select: { slug: true },
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
    // Estas rutas son estáticas desde S14, así que sin invalidarlas el cambio no
    // se ve hasta que expire la revalidación de una hora: aprobar a alguien no
    // lo hacía aparecer, y suspenderlo no lo hacía desaparecer.
    revalidatePath("/profesionales");
    revalidatePath("/profesionales/[slug]", "page");
    revalidatePath("/sitemap.xml");

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
    // Estas rutas son estáticas desde S14, así que sin invalidarlas el cambio no
    // se ve hasta que expire la revalidación de una hora: aprobar a alguien no
    // lo hacía aparecer, y suspenderlo no lo hacía desaparecer.
    revalidatePath("/profesionales");
    revalidatePath("/profesionales/[slug]", "page");
    revalidatePath("/sitemap.xml");

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
    const coverImageAlt = String(postInput?.coverImageAlt || "").trim().slice(0, 300) || null;
    const coverImageAuthor = String(postInput?.coverImageAuthor || "").trim() || null;
    const coverImageNote = String(postInput?.coverImageNote || "").trim() || null;
    const coverImageFocusX = clampInt(postInput?.coverImageFocusX, 0, 100, 50);
    const coverImageFocusY = clampInt(postInput?.coverImageFocusY, 0, 100, 50);
    const coverImageScale = clampInt(postInput?.coverImageScale, 100, 180, 100);
    const metaTitle = String(postInput?.metaTitle || "").trim() || null;
    const metaDescription = String(postInput?.metaDescription || "").trim() || null;
    const ogImage = String(postInput?.ogImage || "").trim() || null;
    const focusKeyword = String(postInput?.focusKeyword || "").trim() || null;
    const noindex = Boolean(postInput?.noindex);
    // Párrafo citable (GEO). Existía en la base y lo reclamaba la deuda
    // editorial, pero no había forma de llenarlo desde ninguna pantalla.
    const extractiveBlock = String(postInput?.extractiveBlock || "").trim() || null;

    if (!id) return { error: "ID de artículo requerido." };
    if (title.length < 4) return { error: "El título debe tener al menos 4 caracteres." };
    if (content.length < 20) return { error: "El contenido debe tener al menos 20 caracteres." };
    if (!slug) return { error: "El slug no puede quedar vacio." };

    const existingSlug = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug && existingSlug.id !== id) {
      return { error: "Ya existe otro artículo con ese slug." };
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        // Marca la edición real del contenido. `updatedAt` no puede usarse para
        // esto: el contador de vistas lo mueve en cada visita.
        contentUpdatedAt: new Date(),
        title,
        slug,
        content,
        excerpt,
        coverImage,
        coverImageTitle,
        coverImageAlt,
        coverImageAuthor,
        coverImageNote,
        coverImageFocusX,
        coverImageFocusY,
        coverImageScale,
        metaTitle,
        metaDescription,
        ogImage,
        focusKeyword,
        noindex,
        extractiveBlock,
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
    return { error: "No se pudo guardar el artículo." };
  }
}

/**
 * Crea un artículo desde el panel admin. Nace como BORRADOR y con un autor
 * profesional asignado (Post.authorId es obligatorio en el schema y el blog
 * público firma cada artículo con ese profesional). El resto de la edición
 * —SEO, portada, taxonomía, publicación— ocurre en /panel/admin/blog/[id].
 */
export async function createAdminPost(input) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const authorId = String(input?.authorId || "").trim();
    const title = String(input?.title || "").trim();
    const content = String(input?.content || "").trim();
    const excerpt = String(input?.excerpt || "").trim() || null;
    const metaTitle = String(input?.metaTitle || "").trim() || null;
    const metaDescription = String(input?.metaDescription || "").trim() || null;
    const ogImage = String(input?.ogImage || "").trim() || null;
    const focusKeyword = String(input?.focusKeyword || "").trim() || null;
    const noindex = Boolean(input?.noindex);
    // Llegan desde el .md importado. Si no se persisten acá, el archivo los trae
    // escritos, la pantalla dice que los detectó, y al guardar se pierden.
    const extractiveBlock = String(input?.extractiveBlock || "").trim() || null;
    const coverImage = String(input?.coverImage || "").trim() || null;
    const coverImageTitle = String(input?.coverImageTitle || "").trim() || null;
    const coverImageAlt = String(input?.coverImageAlt || "").trim().slice(0, 300) || null;
    const coverImageAuthor = String(input?.coverImageAuthor || "").trim() || null;
    const coverImageNote = String(input?.coverImageNote || "").trim() || null;

    if (!authorId) return { error: "Elegí el profesional que firma el artículo." };
    if (title.length < 4) return { error: "El título debe tener al menos 4 caracteres." };
    if (content.length < 20) return { error: "El contenido debe tener al menos 20 caracteres." };

    const author = await prisma.professionalProfile.findUnique({
      where: { id: authorId },
      select: { id: true },
    });
    if (!author) return { error: "El profesional elegido ya no existe." };

    const slug = await slugUnico(
      input?.slug || title,
      async (candidato) =>
        Boolean(await prisma.post.findUnique({ where: { slug: candidato }, select: { id: true } })),
    );

    const seriesName = String(input?.seriesName || "").trim();
    const seriesOrderValue = Number(input?.seriesOrder);
    const seriesOrder = Number.isFinite(seriesOrderValue) && seriesOrderValue > 0
      ? Math.max(1, Math.round(seriesOrderValue))
      : null;
    const series = seriesName
      ? await prisma.series.findFirst({
          where: { isActive: true, OR: [{ name: seriesName }, { slug: slugify(seriesName) }] },
          select: { id: true },
        })
      : null;

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        metaTitle,
        metaDescription,
        ogImage,
        focusKeyword,
        noindex,
        extractiveBlock,
        coverImage,
        coverImageTitle,
        coverImageAlt,
        coverImageAuthor,
        coverImageNote,
        seriesId: series?.id || null,
        seriesOrder: series?.id ? seriesOrder : null,
        seriesApproved: false,
        status: "DRAFT",
        authorId: author.id,
      },
      select: { id: true },
    });

    revalidatePath("/panel/admin/blog");
    return { success: true, id: post.id };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya existe un artículo con ese slug." };
    console.error("Error creando post admin:", error);
    return { error: "No se pudo crear el artículo." };
  }
}

/**
 * Registra la verificación de colegiatura de un profesional.
 *
 * Es el paso del tamizaje previo a la entrevista: el admin busca la matrícula en
 * el registro público del colegio correspondiente y guarda el enlace al punto
 * exacto donde aparece. Queda asentado quién lo verificó y cuándo.
 *
 * Sin esto, `licenseNumber` es un número que el propio profesional declaró y que
 * nadie puede comprobar. La diferencia importa: en salud, una credencial
 * afirmada y una credencial verificada no son lo mismo, y el sitio no debería
 * presentarlas igual.
 */
export async function registrarVerificacionColegiatura(profileId, datos) {
  if (!profileId) return { error: "Falta el perfil." };

  try {
    const session = await getSession();
    requireAdmin(session);

    const colegio = String(datos?.licensingBody || "").trim();
    const url = String(datos?.licenseVerificationUrl || "").trim();
    const matricula = String(datos?.licenseNumber || "").trim();

    if (!colegio) return { error: "Indicá el colegio profesional que emite la matrícula." };
    if (!matricula) return { error: "Indicá el número de matrícula." };

    // Una URL que no se puede abrir no es evidencia de nada. Se valida la forma
    // acá; que apunte al registro correcto lo comprueba quien la pega.
    if (url) {
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("protocolo");
      } catch {
        return { error: "El enlace al registro del colegio no es una URL válida." };
      }
    }

    const perfil = await prisma.professionalProfile.update({
      where: { id: String(profileId) },
      data: {
        licensingBody: colegio,
        licenseNumber: matricula,
        licenseVerificationUrl: url || null,
        licenseVerifiedAt: new Date(),
        // La sesión trae el id en `sub` (JWT) con `userId` como alternativa;
        // es la convención de src/lib/auth.js.
        licenseVerifiedById: String(session?.sub || session?.userId || "") || null,
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/panel/admin/personal");
    if (perfil.slug) revalidatePath(`/profesionales/${perfil.slug}`);

    return { ok: true };
  } catch (error) {
    console.error("[registrarVerificacionColegiatura]", error);
    return { error: "No se pudo registrar la verificación." };
  }
}
