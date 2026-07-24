import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * El blog y la home son ISR: sin esto, un artículo editado (que vuelve a DRAFT)
 * o eliminado seguiría publicado hasta que expire la ventana de revalidación.
 */
function revalidatePublicPost(slug) {
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/");
}

async function getProfessionalId(session) {
  if (!session || session.role !== "PROFESSIONAL") return null;

  if (session.professionalProfileId) return String(session.professionalProfileId);

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    select: { id: true },
  });
  return profile?.id || null;
}

export async function PATCH(request, { params }) {
  try {
    const session = await getSession();
    const professionalId = await getProfessionalId(session);
    if (!professionalId) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const id = params?.id ? String(params.id) : "";
    if (!id) return NextResponse.json({ message: "ID inválido" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();
    const requestedSlug = String(body?.slug || "").trim();
    const coverImage = String(body?.coverImage || "").trim() || null;
    const coverImageTitle = String(body?.coverImageTitle || "").trim() || null;
    const coverImageAuthor = String(body?.coverImageAuthor || "").trim() || null;
    const coverImageNote = String(body?.coverImageNote || "").trim() || null;

    if (!title || !content) {
      return NextResponse.json({ message: "Título y contenido son requeridos" }, { status: 400 });
    }

    const existing = await prisma.post.findFirst({
      where: { id, authorId: professionalId },
      select: { id: true, slug: true },
    });

    if (!existing) return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });

    const nextSlug = requestedSlug ? slugify(requestedSlug) : existing.slug;
    if (!nextSlug) return NextResponse.json({ message: "Slug invalido" }, { status: 400 });
    const duplicate = await prisma.post.findFirst({
      where: { slug: nextSlug, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ message: "Ya existe otro articulo con ese slug" }, { status: 409 });

    const metadata = {};
    if ("metaTitle" in body) metadata.metaTitle = String(body.metaTitle || "").trim() || null;
    if ("metaDescription" in body) metadata.metaDescription = String(body.metaDescription || "").trim() || null;
    if ("focusKeyword" in body) metadata.focusKeyword = String(body.focusKeyword || "").trim() || null;

    const updated = await prisma.post.update({
      where: { id },
      data: {
        title,
        content,
        slug: nextSlug,
        coverImage,
        coverImageTitle,
        coverImageAuthor,
        coverImageNote,
        status: "DRAFT",
        ...metadata,
      },
      select: { id: true, title: true, status: true, updatedAt: true },
    });

    revalidatePublicPost(existing.slug);
    if (nextSlug !== existing.slug) revalidatePublicPost(nextSlug);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error actualizando post profesional:", error);
    return NextResponse.json({ message: "Error actualizando artículo" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const session = await getSession();
    const professionalId = await getProfessionalId(session);
    if (!professionalId) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const id = params?.id ? String(params.id) : "";
    if (!id) return NextResponse.json({ message: "ID inválido" }, { status: 400 });

    const existing = await prisma.post.findFirst({
      where: { id, authorId: professionalId },
      select: { id: true, slug: true },
    });

    if (!existing) return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });

    await prisma.post.delete({ where: { id } });

    revalidatePublicPost(existing.slug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando post profesional:", error);
    return NextResponse.json({ message: "Error eliminando artículo" }, { status: 500 });
  }
}
