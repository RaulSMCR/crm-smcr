"use server";

// Envío manual (v1) de una notificación de artículo nuevo a los lectores afines.
// Solo ADMIN o el PROFESSIONAL autor del post. Sin UI todavía: se invoca desde un
// script/consola o desde un botón futuro en el admin del blog (ver AUDIT-PWA · PUSH).
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Notifica un post publicado a los usuarios con afinidad.
 *
 * "Misma categoría": el modelo Post no tiene categorías ni tags (ver AUDIT-PWA ·
 * DECISIONES), así que la afinidad es por AUTOR — usuarios que ya leyeron algún
 * post de este autor y todavía no vieron este. Título = título del post.
 *
 * @param {string} postId
 */
export async function notifyPostToReaders(postId) {
  const session = await getSession();
  if (!session || !["ADMIN", "PROFESSIONAL"].includes(session.role)) {
    return { error: "No autorizado." };
  }

  const post = await prisma.post.findUnique({
    where: { id: String(postId || "") },
    select: { id: true, title: true, slug: true, excerpt: true, status: true, authorId: true },
  });
  if (!post) return { error: "Artículo no encontrado." };
  if (post.status !== "PUBLISHED") return { error: "El artículo no está publicado." };

  // Un profesional solo puede notificar sus propios artículos.
  if (session.role === "PROFESSIONAL") {
    const myProfileId = session.professionalProfile?.id || session.professionalProfileId || null;
    if (!myProfileId || myProfileId !== post.authorId) {
      return { error: "Solo podés notificar tus propios artículos." };
    }
  }

  // Lectores del autor (afinidad) que aún no vieron ESTE post.
  const readers = await prisma.postViewEvent.findMany({
    where: { userId: { not: null }, post: { authorId: post.authorId } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const candidateIds = readers.map((r) => r.userId).filter(Boolean);

  const alreadySaw = await prisma.postViewEvent.findMany({
    where: { postId: post.id, userId: { in: candidateIds } },
    select: { userId: true },
  });
  const sawSet = new Set(alreadySaw.map((e) => e.userId));
  const targets = candidateIds.filter((id) => !sawSet.has(id));

  const result = await sendPushToUsers(targets, {
    title: post.title,
    body: post.excerpt || "Nuevo artículo en la biblioteca.",
    url: `/blog/${post.slug}`,
  });

  return { ok: true, targets: targets.length, ...result };
}
