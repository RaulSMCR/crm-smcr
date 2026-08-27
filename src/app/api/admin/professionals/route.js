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
        serviceAssignments: { select: { service: { select: { id: true, title: true } } } },
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
      services: (p.serviceAssignments || []).map((sa) => sa.service).filter(Boolean),
    }));

    return NextResponse.json(out);
  } catch (error) {
    console.error("Error fetching professionals:", error);
    return NextResponse.json({ message: "Error al obtener profesionales" }, { status: 500 });
  }
}

// El POST que vivía acá se eliminó el 2026-08-26.
//
// Escribía `services: { set: … }`, una relación que no existe en el schema —la
// buena es `serviceAssignments`—, así que cualquier llamada devolvía 500. Nadie
// lo invocaba: el único consumidor de esta ruta es el GET.
//
// No se arregló, se quitó. Reescribirlo habría duplicado `syncServiceAssignments`
// (src/actions/service-actions.js), que además de asignar exige precio y siembra
// la tarifa vigente. Un segundo camino sin esas salvaguardas reabre el defecto
// que dejó a tres profesionales publicados sin precio y sin agenda.
//
// Para asignar servicios a un profesional: `syncServiceAssignments` desde el
// panel del servicio, o `reviewServiceAssignment` para aprobar una solicitud.
