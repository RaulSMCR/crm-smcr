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

    // Métricas rápidas (sin filtros aún)
    const [
      usersTotal,
      professionalsTotal,
      professionalsPending,
      postsTotal,
      postsPending,
      appointmentsTotal,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.professional.count(),
      prisma.professional.count({ where: { emailVerified: true, isApproved: false } }),
      prisma.post.count(),
      prisma.post.count({ where: { status: "PENDING" } }),
      prisma.appointment.count(),
    ]);

    // Listas cortas útiles
    const [pendingProfessionals, recentUsers, recentPosts] = await Promise.all([
      prisma.professional.findMany({
        where: { emailVerified: true, isApproved: false },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          id: true,
          name: true,
          profession: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          postType: true,
          createdAt: true,
          author: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      metrics: {
        usersTotal,
        professionalsTotal,
        professionalsPending,
        postsTotal,
        postsPending,
        appointmentsTotal,
      },
      lists: {
        pendingProfessionals,
        recentUsers,
        recentPosts,
      },
    });
  } catch (e) {
    console.error("ADMIN dashboard summary error:", e);
    return NextResponse.json(
      { error: "Error al cargar el dashboard" },
      { status: 500 }
    );
  }
}
