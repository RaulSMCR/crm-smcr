// src/app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // ✅ Cookie correcta (coincide con lib/auth.js + middleware)
    const token = request.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    // Verifica JWT (firma + exp)
    const payload = await verifyToken(token);

    const userId = payload?.userId;
    if (!userId) {
      return NextResponse.json({ message: "Datos de sesión inválidos" }, { status: 401 });
    }

    // Traemos estado real desde DB (fuente de verdad)
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        isActive: true,
        emailVerified: true,
        professionalProfile: {
          select: {
            id: true,
            slug: true,
            specialty: true,
            licenseNumber: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 });
    }

    // Estado de cuenta
    if (!user.isActive) {
      return NextResponse.json({ message: "Cuenta desactivada" }, { status: 403 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ message: "Email no verificado", error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }

    if (user.role === "PROFESSIONAL" && user.isApproved === false) {
      return NextResponse.json(
        { message: "Cuenta pendiente de aprobación", error: "PRO_NOT_APPROVED" },
        { status: 403 }
      );
    }

    // Respuesta consistente para el Header y para paneles
    return NextResponse.json(
      {
        ok: true,
        role: user.role,
        id: user.id,
        name: user.name,
        email: user.email,
        professionalProfile: user.professionalProfile || null,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Auth Me Error:", e);
    return NextResponse.json({ message: "Sesión expirada" }, { status: 401 });
  }
}
