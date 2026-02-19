// src/app/api/admin/dashboard/summary/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }
    if (session.role !== "ADMIN") {
      return NextResponse.json({ message: "Acción no permitida" }, { status: 403 });
    }

    const [usersCount, prosCount, servicesCount, appointmentsCount] = await Promise.all([
      prisma.user.count(),
      prisma.professionalProfile.count(),
      prisma.service.count(),
      prisma.appointment.count(),
    ]);

    return NextResponse.json({
      users: usersCount,
      professionals: prosCount,
      services: servicesCount,
      appointments: appointmentsCount,
    });
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
