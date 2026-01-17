import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// ESTA LÍNEA ES LA SOLUCIÓN:
// Fuerza a Next.js a no intentar generar esta página estáticamente (HTML) en el build.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const token = request.cookies?.get("sessionToken")?.value;
    
    // Si no hay token, 401 inmediato.
    if (!token) {
        return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    // Verificación de seguridad adicional: parsear a entero seguro.
    const userId = Number(payload.userId);
    
    if (!userId) {
        return NextResponse.json({ message: "Sesión inválida" }, { status: 401 });
    }

    const appointments = await prisma.appointment.findMany({
      where: { userId },
      orderBy: [{ startTime: "asc" }],
      select: {
        id: true,
        startTime: true, // Prisma devuelve objetos Date
        endTime: true,
        status: true,
        priceFinal: true,
        canceledAt: true,
        cancelReason: true,
        professional: {
          select: { id: true, name: true, profession: true, calendarUrl: true },
        },
        service: {
          select: { id: true, title: true, durationMin: true, price: true, slug: true },
        },
      },
    });

    return NextResponse.json({ ok: true, appointments });
  } catch (e) {
    console.error("GET /api/appointments/my error:", e);
    return NextResponse.json({ message: "Error al cargar citas" }, { status: 500 });
  }
}