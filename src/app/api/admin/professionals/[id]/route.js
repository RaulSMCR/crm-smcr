import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    // 1) Validar sesión y rol ADMIN
    const sessionToken = request.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const payload = await verifyToken(sessionToken);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    // 2) Validar ID
    const professionalId = Number(params?.id);
    if (!Number.isInteger(professionalId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 3) Leer profesional
    const prof = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        name: true,
        email: true,
        profession: true,
        phone: true,
        bio: true,
        avatarUrl: true,
        resumeUrl: true,
        introVideoUrl: true,
        calendarUrl: true,
        paymentLinkBase: true,
        timeZone: true,

        emailVerified: true,
        isApproved: true,

        createdAt: true,
        updatedAt: true,

        approvedAt: true,
        approvedByUserId: true,
      },
    });

    if (!prof) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json(prof, { status: 200 });
  } catch (e) {
    console.error("ADMIN get professional detail error:", e);
    return NextResponse.json({ error: "Error al cargar profesional" }, { status: 500 });
  }
}
