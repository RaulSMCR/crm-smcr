import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCarouselActor } from "@/lib/carousel-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Limpia el HTML del cuerpo del post a texto plano usable como fuente de artículo.
function stripHtml(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req) {
  const { actor, res } = await getCarouselActor();
  if (res) return res;

  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, title: true, content: true, authorId: true },
    });
    if (!post) return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });
    // Profesional solo puede tomar contenido de sus propios artículos.
    if (!actor.isAdmin && post.authorId !== actor.profileId) {
      return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ id: post.id, title: post.title, text: stripHtml(post.content) });
  }

  // Admin ve todos los artículos; profesional solo los propios.
  const where = actor.isAdmin ? undefined : { authorId: actor.profileId };
  const posts = await prisma.post.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, status: true, updatedAt: true },
    take: 100,
  });

  return NextResponse.json({
    posts: posts.map((p) => ({ id: p.id, title: p.title, status: p.status })),
  });
}
