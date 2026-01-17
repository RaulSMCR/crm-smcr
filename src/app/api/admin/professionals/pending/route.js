import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request) {
  try {
    const sessionToken = request.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const payload = await verifyToken(sessionToken);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    const professionals = await prisma.professional.findMany({
      where: {
        isApproved: false,
        emailVerified: true,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        profession: true,
        email: true,
        avatarUrl: true,
        resumeUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(professionals);
  } catch (e) {
    console.error("ADMIN pending professionals error:", e);
    return NextResponse.json(
      { error: "Error al cargar profesionales pendientes" },
      { status: 500 }
    );
  }
}
