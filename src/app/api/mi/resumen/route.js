// src/app/api/mi/resumen/route.js
// Resumen del Inicio de la PWA: próxima cita, contadores y última lectura.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/mi/api-session";
import {
  appointmentSelect,
  appointmentDTO,
  UPCOMING_STATUSES,
  ACTIVE_PAYMENT_STATUSES,
} from "@/lib/mi/serializers";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requirePatientSession(request);
  if (auth instanceof NextResponse) return auth;

  const patientId = String(auth.session.userId || auth.session.sub);
  const now = new Date();

  try {
    const [proximaCita, proximasCitas, pagosPendientes, ultimaLectura] = await Promise.all([
      prisma.appointment.findFirst({
        where: { patientId, date: { gte: now }, status: { in: UPCOMING_STATUSES } },
        orderBy: { date: "asc" },
        select: appointmentSelect,
      }),
      prisma.appointment.count({
        where: { patientId, date: { gte: now }, status: { in: UPCOMING_STATUSES } },
      }),
      prisma.paymentTransaction.count({
        where: { patientId, status: { in: ACTIVE_PAYMENT_STATUSES } },
      }),
      prisma.postViewEvent.findFirst({
        where: { userId: patientId, isRead: true, post: { status: "PUBLISHED" } },
        orderBy: { readAt: "desc" },
        select: { readAt: true, post: { select: { title: true, slug: true } } },
      }),
    ]);

    return NextResponse.json({
      proximaCita: appointmentDTO(proximaCita),
      contadores: { proximasCitas, pagosPendientes },
      ultimaLectura: ultimaLectura?.post
        ? { title: ultimaLectura.post.title, slug: ultimaLectura.post.slug, readAt: ultimaLectura.readAt }
        : null,
    });
  } catch (error) {
    console.error("[/api/mi/resumen] error:", error);
    return NextResponse.json({ error: "No se pudo cargar el resumen." }, { status: 500 });
  }
}
