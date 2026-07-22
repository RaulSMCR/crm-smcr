import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { slugify } from "@/lib/carousel-spec";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { res: NextResponse.json({ message: "No autorizado" }, { status: 401 }) };
  if (session.role !== "ADMIN") return { res: NextResponse.json({ message: "Acción no permitida" }, { status: 403 }) };
  return { session };
}

async function uniquePostSlug(base) {
  const root = slugify(base) || "articulo";
  let slug = root;
  let i = 2;
  // Colisiones: sufijo incremental.
  while (await prisma.post.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${root}-${i}`;
    i += 1;
  }
  return slug;
}

export async function POST(req, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;
  const { id } = await params;

  const carousel = await prisma.carousel.findUnique({
    where: { id },
    select: { id: true, title: true, sourceText: true, sourcePostId: true, blogPostId: true },
  });
  if (!carousel) return NextResponse.json({ message: "Carrusel no encontrado" }, { status: 404 });

  // Ya está en el blog: no duplicar.
  if (carousel.sourcePostId) {
    return NextResponse.json(
      { message: "El artículo fuente ya es una entrada del blog.", postId: carousel.sourcePostId, already: true },
      { status: 409 }
    );
  }
  if (carousel.blogPostId) {
    return NextResponse.json(
      { message: "Este carrusel ya se envió al blog.", postId: carousel.blogPostId, already: true },
      { status: 409 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const authorId = String(body.authorId || "").trim();
  if (!authorId) {
    return NextResponse.json({ message: "Elige un autor (profesional) para el artículo." }, { status: 422 });
  }
  const author = await prisma.professionalProfile.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) {
    return NextResponse.json({ message: "El autor seleccionado no existe." }, { status: 422 });
  }

  const title = (typeof body.title === "string" && body.title.trim()) || carousel.title;
  const slug = await uniquePostSlug(title);
  // Si el carrusel no trae artículo fuente, se crea un borrador vacío para redactar
  // en el editor de blog (portada, contenido, descripción, etc.).
  const content = (carousel.sourceText || "").trim() || "Redacta el contenido del artículo en este editor.";
  const excerptRaw = content.replace(/\s+/g, " ").trim();
  const excerpt = excerptRaw.length > 220 ? `${excerptRaw.slice(0, 220)}…` : excerptRaw;

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      excerpt,
      status: "DRAFT",
      authorId,
    },
    select: { id: true, slug: true },
  });

  await prisma.carousel.update({ where: { id }, data: { blogPostId: post.id } });

  return NextResponse.json({ postId: post.id, slug: post.slug, status: "DRAFT" }, { status: 201 });
}
