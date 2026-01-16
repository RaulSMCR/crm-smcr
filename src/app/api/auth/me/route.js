// src/app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request) {
  try {
    const token = request.cookies.get("sessionToken")?.value;
    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    const role = payload?.role;
    const id = Number(payload?.userId);

    if (!role || !Number.isInteger(id)) {
      return NextResponse.json({ message: "Sesión inválida" }, { status: 401 });
    }

    if (role === "PROFESSIONAL") {
      const pro = await prisma.professional.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          profession: true,
          isApproved: true,
          calendarUrl: true,
        },
      });

      if (!pro) return NextResponse.json({ message: "No autenticado" }, { status: 401 });
      if (!pro.isApproved) {
        return NextResponse.json({ message: "Profesional no aprobado" }, { status: 403 });
      }

      return NextResponse.json({ ok: true, role, profile: pro }, { status: 200 });
    }

    // USER o ADMIN
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

    return NextResponse.json(
      { ok: true, role: user.role || role, profile: user },
      { status: 200 }
    );
  } catch (e) {
    // Token inválido/expirado => no autenticado
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }
}
