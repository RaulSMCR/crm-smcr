import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Lo que ve el profesional cuando administración no escribe nada. Es el peor
 * caso, no el normal: no dice qué corregir. */
const NOTA_POR_DEFECTO = "Revisá el contenido de la reseña y volvé a enviarlo para aprobación.";
const NOTA_MAX = 1000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Accion no permitida" }, { status: 403 });
    }

    let adminNote = "";
    try {
      const body = await request.json();
      adminNote = String(body?.adminNote || "").trim().slice(0, NOTA_MAX);
    } catch {
      // Sin cuerpo o JSON inválido: se envía la nota genérica.
    }

    const professionalId = String((await params)?.id || "");
    if (!professionalId) {
      return NextResponse.json({ message: "ID de profesional invalido" }, { status: 400 });
    }

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { id: true, slug: true, profileReviewDraft: true },
    });

    if (!profile) {
      return NextResponse.json({ message: "Profesional no encontrado" }, { status: 404 });
    }

    if (!profile.profileReviewDraft || !profile.profileReviewDraft.trim()) {
      return NextResponse.json({ message: "No hay resena pendiente para rechazar." }, { status: 400 });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        profileReviewStatus: "REJECTED",
        profileReviewReviewedAt: new Date(),
        profileReviewAdminNote: adminNote || NOTA_POR_DEFECTO,
      },
      select: { id: true, slug: true, profileReviewStatus: true },
    });

    revalidatePath("/panel/admin");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/profesional/perfil");
    if (updated.slug) revalidatePath(`/profesionales/${updated.slug}`);

    return NextResponse.json({
      id: updated.id,
      status: updated.profileReviewStatus,
    });
  } catch (error) {
    console.error("reject profile review error:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
