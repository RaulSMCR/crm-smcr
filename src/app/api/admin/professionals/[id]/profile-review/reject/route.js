import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Accion no permitida" }, { status: 403 });
    }

    const professionalId = String(params?.id || "");
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
        profileReviewAdminNote: "Revise el contenido de la resena y vuelva a enviarlo para aprobacion.",
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
