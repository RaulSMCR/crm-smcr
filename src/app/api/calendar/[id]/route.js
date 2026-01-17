// src/app/api/calendar/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const professionalId = Number(params.id);

  if (!Number.isFinite(professionalId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    // 1) Obtener tokens del profesional
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { googleRefreshToken: true },
    });

    if (!professional?.googleRefreshToken) {
      return NextResponse.json(
        { error: "El profesional no ha conectado su calendario." },
        { status: 400 }
      );
    }

    // 2) Cliente Calendar autenticado con refresh token
    const calendar = getCalendarClient(professional.googleRefreshToken);

    // 3) Consultar horarios ocupados (próximos 30 días)
    const timeMin = new Date();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busySlots = response?.data?.calendars?.primary?.busy ?? [];

    // 4) Devolver horarios ocupados
    return NextResponse.json({ busy: busySlots });
  } catch (error) {
    console.error("Error fetching calendar availability:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la disponibilidad del calendario." },
      { status: 500 }
    );
  }
}
