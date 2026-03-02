import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@/lib/prisma";
import { sendAppointmentNotifications } from "@/lib/appointments";
import { NextResponse } from "next/server";

const CANCELLED_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

async function handler(req) {
  try {
    const { appointmentId, type } = await req.json();

    if (!appointmentId || !type) {
      return NextResponse.json({ ok: false, reason: "Missing fields" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { select: { name: true, email: true } },
        professional: {
          select: {
            id: true,
            googleRefreshToken: true,
            user: { select: { name: true, email: true } },
          },
        },
        service: { select: { title: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ ok: false, reason: "Appointment not found" });
    }

    if (CANCELLED_STATUSES.has(appointment.status)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Appointment cancelled" });
    }

    const label = type === "24h" ? "24 horas" : "1 hora";
    await sendAppointmentNotifications(
      appointment,
      `Recordatorio: Tu cita comienza en ${label}.`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reminder handler error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
