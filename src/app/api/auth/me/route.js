// PATH: src/app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // Cookie correcta (coincide con lib/auth.js + middleware)
    const token = request.cookies.get("session")?.value;

    // Respuesta consistente (siempre { ok: boolean })
    if (!token) {
      return NextResponse.json({ ok: false, message: "No autenticado" }, { status: 401 });
    }

    // Verifica JWT (firma + exp)
    const payload = await verifyToken(token);

    // Aceptamos userId o sub (por compatibilidad con tokens ya emitidos)
    const userId = String(payload?.userId || payload?.sub || "");
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Datos de sesión inválidos" }, { status: 401 });
    }

    // Fuente de verdad: DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      return NextResponse.json({ ok: false, message: "Usuario no encontrado" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ ok: false, message: "Cuenta desactivada" }, { status: 403 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { ok: false, message: "Email no verificado", error: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    if (user.role === "PROFESSIONAL" && user.isApproved === false) {
      return NextResponse.json(
        { ok: false, message: "Cuenta pendiente de aprobación", error: "PRO_NOT_APPROVED" },
        { status: 403 }
      );
    }

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

    // Si el token está roto/expirado, devolvemos 401 consistente.
    // (Opcional) podríamos limpiar cookie aquí, pero middleware ya se encarga al no validar.
    return NextResponse.json({ ok: false, message: "Sesión expirada" }, { status: 401 });
  }
}
