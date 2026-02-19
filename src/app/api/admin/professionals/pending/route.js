// src/app/api/admin/professionals/pending/route.js
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

    const pending = await prisma.professionalProfile.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        specialty: true,
        cvUrl: true,
        createdAt: true,
        user: { select: { name: true, email: true, phone: true, emailVerified: true } },
      },
      take: 200,
    });

    // Adapter para compat con pantallas antiguas
    const out = pending.map((p) => ({
      id: p.id,
      name: p.user?.name || "",
      email: p.user?.email || "",
      profession: p.specialty, // "profession" legacy
      phone: p.user?.phone || "",
      emailVerified: !!p.user?.emailVerified,
      isApproved: false,
      resumeUrl: p.cvUrl || null, // "resumeUrl" legacy
      createdAt: p.createdAt,
    }));

    return NextResponse.json(out);
  } catch (error) {
    console.error("Pending Pros Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
