// src/app/api/posts/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readingTimeFromText(content) {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words) return null;
  return Math.max(1, Math.round(words / 200)); // ~200 wpm
}

async function requireProfessionalApproved(session) {
  if (!session) return { ok: false, status: 401, message: "No autorizado" };
  if (session.role !== "PROFESSIONAL") return { ok: false, status: 403, message: "Acción no permitida" };

  const proId = session.professionalProfileId ? String(session.professionalProfileId) : null;
  if (!proId) return { ok: false, status: 400, message: "Token inválido (falta professionalProfileId)" };

  const prof = await prisma.professionalProfile.findUnique({
    where: { id: proId },
    select: { id: true, isApproved: true },
  });
  if (!prof) return { ok: false, status: 404, message: "Profesional no encontrado" };
  if (!prof.isApproved) return { ok: false, status: 403, message: "Tu cuenta aún no fue aprobada por un administrador" };

  return { ok: true, proId };
}

export async function POST(request) {
  try {
    const session = await getSession();
    const guard = await requireProfessionalApproved(session);
    if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();

    // compat legacy
    const coverImage = String(body?.coverImage || body?.imageUrl || "").trim() || null;

    const excerpt = String(body?.excerpt || "").trim() || null;
    const categoryId = body?.categoryId ? String(body.categoryId) : null;
    const metaTitle = String(body?.metaTitle || "").trim() || null;
    const metaDesc = String(body?.metaDesc || "").trim() || null;

    if (!title || !content) {
      return NextResponse.json({ message: "Título y contenido son requeridos" }, { status: 400 });
    }

    let slug = slugify(title);
    if (!slug) slug = `post-${Date.now()}`;

    // evitar colisión de slug
    const exists = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;

    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!cat) return NextResponse.json({ message: "Categoría no existe" }, { status: 404 });
    }

    const readingTime = readingTimeFromText(content);

    const newPost = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImage,
        status: "DRAFT",
        ...(readingTime ? { readingTime } : {}),
        ...(metaTitle ? { metaTitle } : {}),
        ...(metaDesc ? { metaDesc } : {}),
        authorId: String(guard.proId),
        ...(categoryId ? { categoryId } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "Slug duplicado." }, { status: 409 });
    }
    console.error("Error creando post:", error);
    return NextResponse.json({ message: "Error al crear el artículo" }, { status: 500 });
  }
}
