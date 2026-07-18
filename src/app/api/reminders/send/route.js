import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@/lib/prisma";
import { sendAppointmentNotifications } from "@/lib/appointments";
import { sendPushToUser } from "@/lib/push/send";
import { DEFAULT_TZ } from "@/lib/timezone";
import { NextResponse } from "next/server";

const CANCELLED_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

// Canal push del recordatorio. Aislado en su propio try/catch: un fallo de push
// jamás debe impedir el email ni romper el job. Las suscripciones muertas se
// podan dentro de sendPushToUser (404/410).
async function sendReminderPush(appointment, type) {
  try {
    const proName = appointment.professional?.user?.name || "tu profesional";
    const time = new Intl.DateTimeFormat("es-CR", {
      timeZone: DEFAULT_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(appointment.date));

    const body =
      type === "24h" ? `Mañana a las ${time} con ${proName}` : "Tu cita es en 1 hora";

    await sendPushToUser(appointment.patientId, {
      title: "Recordatorio de cita",
      body,
      url: "/mi/agenda",
    });
  } catch (err) {
    console.error("[reminders] push falló (email no afectado):", err?.message || err);
  }
}

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
      `Recordatorio: la cita inicia en ${label}.`
    );

    // Canal push adicional (no bloquea ni afecta el email de arriba).
    await sendReminderPush(appointment, type);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reminder handler error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);

