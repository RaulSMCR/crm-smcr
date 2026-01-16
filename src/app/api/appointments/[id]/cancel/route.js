import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const token = request.cookies?.get("sessionToken")?.value;
    if (!token) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

    const payload = await verifyToken(token);
    const userId = Number(payload.userId);
    const id = Number(params.id);
    if (!userId || !id) return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim().slice(0, 500);

    const appt = await prisma.appointment.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!appt) return NextResponse.json({ message: "Cita no encontrada" }, { status: 404 });

    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appt.status)) {
      return NextResponse.json({ message: "Esta cita no se puede cancelar." }, { status: 409 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        canceledAt: new Date(),
        cancelReason: reason || null,
      },
      select: { id: true, status: true, canceledAt: true },
    });

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e) {
    console.error("POST /api/appointments/[id]/cancel error:", e);
    return NextResponse.json({ message: "Error al cancelar" }, { status: 500 });
  }
}
