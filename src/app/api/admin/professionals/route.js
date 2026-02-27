// src/app/api/admin/professionals/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    const professionals = await prisma.professionalProfile.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        specialty: true,
        isApproved: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        serviceAssignments: {
          where: { status: "APPROVED" },
          select: { service: { select: { id: true, title: true } } },
        },
      },
      take: 200,
    });

    // Adapter compat
    const out = professionals.map((p) => ({
      id: p.id,
      name: p.user?.name || "",
      email: p.user?.email || "",
      profession: p.specialty,
      isApproved: p.isApproved,
      createdAt: p.createdAt,
      services: p.serviceAssignments.map((a) => a.service),
    }));

    return NextResponse.json(out);
  } catch (error) {
    console.error("Error fetching professionals:", error);
    return NextResponse.json({ message: "Error al obtener profesionales" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    const data = await request.json().catch(() => ({}));
    const { professionalProfileId, email, serviceIds, isApproved } = data || {};

    let profId = professionalProfileId ? String(professionalProfileId) : null;

    if (!profId && email) {
      const user = await prisma.user.findUnique({
        where: { email: String(email) },
        select: { id: true, professionalProfile: { select: { id: true } } },
      });
      profId = user?.professionalProfile?.id || null;
    }

    if (!profId) {
      return NextResponse.json(
        { message: "Debes enviar professionalProfileId o email de un profesional existente." },
        { status: 400 }
      );
    }

    const ids = Array.isArray(serviceIds) ? serviceIds.map(String).filter(Boolean) : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.professionalProfile.update({
        where: { id: profId },
        data: {
          ...(typeof isApproved === "boolean" ? { isApproved } : {}),
        },
      });

      if (ids) {
        await tx.serviceAssignment.deleteMany({ where: { professionalId: profId } });
        if (ids.length) {
          await tx.serviceAssignment.createMany({
            data: ids.map((id) => ({
              professionalId: profId,
              serviceId: id,
              status: "APPROVED",
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.professionalProfile.findUnique({
        where: { id: profId },
        select: {
          id: true,
          specialty: true,
          isApproved: true,
          user: { select: { name: true, email: true } },
          serviceAssignments: {
            where: { status: "APPROVED" },
            select: { service: { select: { id: true, title: true } } },
          },
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.user?.name || "",
      email: updated.user?.email || "",
      profession: updated.specialty,
      isApproved: updated.isApproved,
      services: updated.serviceAssignments.map((a) => a.service),
    });
  } catch (error) {
    console.error("Error updating professional via POST:", error);
    return NextResponse.json({ message: error.message || "Error interno" }, { status: 500 });
  }
}
