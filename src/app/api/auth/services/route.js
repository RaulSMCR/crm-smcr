// src/app/api/auth/services/route.js
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

    const role = String(session.role || "");
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const take = clampInt(searchParams.get("limit") || 50, 1, 100, 50);

    const titleFilter = q ? { title: { contains: q, mode: "insensitive" } } : {};

    if (role === "ADMIN") {
      const services = await prisma.service.findMany({
        where: { ...titleFilter },
        orderBy: { title: "asc" },
        take,
        select: { id: true, title: true, price: true, durationMin: true, isActive: true },
      });
      return NextResponse.json(services);
    }

    if (role === "PROFESSIONAL") {
      const proId =
        (session.professionalProfileId && String(session.professionalProfileId)) ||
        (session.userId && (await prisma.professionalProfile.findUnique({
          where: { userId: String(session.userId) },
          select: { id: true },
        }))?.id) ||
        (session.sub && (await prisma.professionalProfile.findUnique({
          where: { userId: String(session.sub) },
          select: { id: true },
        }))?.id);

      if (!proId) return NextResponse.json({ message: "Perfil profesional no encontrado" }, { status: 404 });

      const prof = await prisma.professionalProfile.findUnique({
        where: { id: String(proId) },
        select: { id: true, isApproved: true },
      });

      if (!prof) return NextResponse.json({ message: "Profesional no encontrado" }, { status: 404 });
      if (!prof.isApproved) return NextResponse.json({ message: "Tu cuenta aún no fue aprobada" }, { status: 403 });

      const services = await prisma.service.findMany({
        where: {
          ...titleFilter,
          professionalAssignments: {
            some: {
              professionalId: String(proId),
              status: "APPROVED",
            },
          },
        },
        orderBy: { title: "asc" },
        take,
        select: { id: true, title: true, price: true, durationMin: true, isActive: true },
      });

      return NextResponse.json(services);
    }

    return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
  } catch (e) {
    console.error("GET /api/auth/services error:", e);
    return NextResponse.json({ message: "Error al obtener servicios" }, { status: 500 });
  }
}
