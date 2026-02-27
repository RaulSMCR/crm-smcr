import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
    const coverImage = String(body?.coverImage || "").trim() || null;

    if (!title || !content) {
      return NextResponse.json({ message: "Título y contenido son requeridos" }, { status: 400 });
    }

    const existing = await prisma.post.findFirst({
      where: { id, authorId: professionalId },
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });

    const updated = await prisma.post.update({
      where: { id },
      data: { title, content, coverImage, status: "DRAFT" },
      select: { id: true, title: true, status: true, updatedAt: true },
    });

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
      select: { id: true },
    });

    if (!existing) return NextResponse.json({ message: "Artículo no encontrado" }, { status: 404 });

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando post profesional:", error);
    return NextResponse.json({ message: "Error eliminando artículo" }, { status: 500 });
  }
}
