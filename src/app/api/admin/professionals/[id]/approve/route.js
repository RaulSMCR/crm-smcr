// src/app/api/admin/professionals/[id]/approve/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    const professionalId = params?.id;
    if (!professionalId) {
      return NextResponse.json({ message: "ID de profesional inválido" }, { status: 400 });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data: { isApproved: true },
      select: {
        id: true,
        isApproved: true,
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      isApproved: updated.isApproved,
      name: updated.user?.name || "",
      email: updated.user?.email || "",
    });
  } catch (e) {
    if (e?.code === "P2025") {
      return NextResponse.json({ message: "El profesional no existe en la base de datos." }, { status: 404 });
    }
    console.error("Error approve professional:", e);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
