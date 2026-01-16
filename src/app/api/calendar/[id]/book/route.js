// src/app/api/calendar/[id]/book/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(request, { params }) {
  try {
    const professionalId = Number(params?.id);
    if (!Number.isInteger(professionalId)) {
      return NextResponse.json({ message: "Profesional inválido" }, { status: 400 });
    }

    // ✅ Requiere sesión USER
    const token = request.cookies?.get("sessionToken")?.value;
    if (!token) {
      // redirigir a login y volver aquí
      const url = new URL(request.url);
      const backTo = `/perfil/${professionalId}/calendar`;
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(backTo)}`, url.origin));
    }

    const payload = await verifyToken(token);
    const userId = Number(payload?.userId);
    const role = payload?.role;
    if (!userId || role !== "USER") {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 });
    }

    const form = await request.formData();
    const startTime = new Date(String(form.get("startTime") || ""));
    const endTime = new Date(String(form.get("endTime") || ""));
    const professionalServiceId = Number(form.get("professionalServiceId"));

    if (!Number.isInteger(professionalServiceId)) {
      return NextResponse.json({ message: "Seleccioná un servicio" }, { status: 400 });
    }
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      return NextResponse.json({ message: "Horario inválido" }, { status: 400 });
    }

    // Validar que el profesional existe y está aprobado
    const pro = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true, isApproved: true },
    });
    if (!pro || !pro.isApproved) {
      return NextResponse.json({ message: "Profesional no disponible" }, { status: 404 });
    }

    // Validar que ese professionalServiceId pertenece al profesional y está activo
    const ps = await prisma.servicesOnProfessionals.findUnique({
      where: { id: professionalServiceId },
      select: {
        id: true,
        professionalId: true,
        serviceId: true,
        status: true,
        priceOverride: true,
        service: { select: { price: true } },
      },
    });

    if (!ps || ps.professionalId !== professionalId || ps.status !== "ACTIVE") {
      return NextResponse.json({ message: "Servicio no disponible" }, { status: 400 });
    }

    const priceFinal = ps.priceOverride ?? ps.service.price;

    // Chequeo de choque (server-side)
    const existing = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { not: "CANCELLED" },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { startTime: true, endTime: true },
      take: 10,
    });

    if (existing.some((x) => overlaps(startTime, endTime, x.startTime, x.endTime))) {
      return NextResponse.json(
        { message: "Ese horario ya no está disponible. Elegí otro." },
        { status: 409 }
      );
    }

    // Crear cita
    await prisma.appointment.create({
      data: {
        userId,
        professionalId,
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        startTime,
        endTime,
        status: "CONFIRMED",
        priceFinal,
      },
    });

    // Redirigir al dashboard para que la vea en "Tus citas"
    const url = new URL(request.url);
    return NextResponse.redirect(new URL("/dashboard", url.origin));
  } catch (e) {
    console.error("POST /api/calendar/[id]/book error:", e);
    return NextResponse.json({ message: "Error al agendar" }, { status: 500 });
  }
}
