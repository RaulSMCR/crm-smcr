// src/app/api/admin/posts/[id]/approve/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_request, { params }) {
  try {
    // 1) Auth (cookie correcta: "session")
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    // 2) Params
    const postId = params?.id ? String(params.id) : "";
    if (!postId) {
      return NextResponse.json({ message: "ID de post inválido" }, { status: 400 });
    }

    // 3) Publicar (tu schema NO tiene approvedById)
    const updated = await prisma.post.update({
      where: { id: postId },
      data: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    // Prisma: record not found
    if (e?.code === "P2025") {
      return NextResponse.json({ message: "Post no encontrado" }, { status: 404 });
    }
    console.error("ADMIN approve post error:", e);
    return NextResponse.json({ message: "Error al aprobar publicación" }, { status: 500 });
  }
}
