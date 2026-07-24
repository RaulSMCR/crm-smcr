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

async function requireProfessionalApproved(session) {
  if (!session) return { ok: false, status: 401, message: "No autorizado" };
  if (session.role !== "PROFESSIONAL") return { ok: false, status: 403, message: "Accion no permitida" };

  const proId = session.professionalProfileId ? String(session.professionalProfileId) : null;
  if (!proId) return { ok: false, status: 400, message: "Token invalido (falta professionalProfileId)" };

  const prof = await prisma.professionalProfile.findUnique({
    where: { id: proId },
    select: { id: true, isApproved: true },
  });
  if (!prof) return { ok: false, status: 404, message: "Profesional no encontrado" };
  if (!prof.isApproved) return { ok: false, status: 403, message: "La cuenta aun no fue aprobada por un administrador" };

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
    const requestedSlug = String(body?.slug || "").trim();
    const metaTitle = String(body?.metaTitle || "").trim() || null;
    const metaDescription = String(body?.metaDescription || "").trim() || null;
    const focusKeyword = String(body?.focusKeyword || "").trim() || null;
    const coverImage = String(body?.coverImage || body?.imageUrl || "").trim() || null;
    const excerpt = String(body?.excerpt || "").trim() || null;
    const coverImageTitle = String(body?.coverImageTitle || "").trim() || null;
    const coverImageAuthor = String(body?.coverImageAuthor || "").trim() || null;
    const coverImageNote = String(body?.coverImageNote || "").trim() || null;

    if (!title || !content) {
      return NextResponse.json({ message: "Titulo y contenido son requeridos" }, { status: 400 });
    }

    let slug = slugify(requestedSlug || title);
    if (!slug) slug = `post-${Date.now()}`;

    const exists = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;

    const newPost = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        metaTitle,
        metaDescription,
        focusKeyword,
        excerpt,
        coverImage,
        coverImageTitle,
        coverImageAuthor,
        coverImageNote,
        status: "DRAFT",
        authorId: String(guard.proId),
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
    return NextResponse.json({ message: "Error al crear el articulo" }, { status: 500 });
  }
}
