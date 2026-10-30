import { withQstashSignature } from "@/lib/qstash-webhook";
import { prisma } from "@/lib/prisma";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";
import { PLAZO_DE_RECORDATORIO, RECORDATORIO_FINAL } from "@/lib/recordatorios";
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
      type === "24h"
        ? `Mañana a las ${time} con ${proName}`
        : `Tu cita es en ${PLAZO_DE_RECORDATORIO[type] || "unos minutos"}`;

    await sendPushToUser(appointment.patientId, {
      title: "Recordatorio de cita",
      body,
      url: "/mi/agenda",
    });
  } catch (err) {
    console.error("[reminders] push falló (email no afectado):", err?.message || err);
  }
}

/**
 * El enlace de Meet que va en el último recordatorio. Si la cita todavía no lo
 * tiene —Google no respondió al agendar, o la sala quedó pendiente— se le pide
 * a Google en este momento. Sin enlace, se avisa al profesional para que lo
 * mande él: el paciente no puede quedarse esperando sin forma de entrar.
 */
async function opcionesDeSesionVirtual(appointment) {
  let enlace = appointment.meetLink || null;
  if (!enlace && appointment.professional?.googleRefreshToken) {
    await syncGoogleCalendarEvent(appointment);
    const actualizada = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      select: { meetLink: true },
    });
    enlace = actualizada?.meetLink || null;
  }
  if (enlace) return { enlaceVirtual: enlace };
  return {
    enlaceVirtual: false,
    notaProfesional:
      "Esta cita virtual no tiene enlace de Google Meet y el paciente no lo recibió. Envíeselo antes de empezar la sesión.",
  };
}

async function handler(req) {
  try {
    const { appointmentId, type, appointmentDate } = await req.json();

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

    // QStash no se puede desprogramar: si la cita se reagendó, el recordatorio
    // viejo llega igual, con la hora anterior. Los mensajes programados antes de
    // que viajara la fecha no la traen y se envían como siempre.
    if (appointmentDate && new Date(appointmentDate).getTime() !== new Date(appointment.date).getTime()) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Appointment rescheduled" });
    }

    const label = PLAZO_DE_RECORDATORIO[type] || type;
    const opciones = type === RECORDATORIO_FINAL && appointment.modality === "VIRTUAL"
      ? await opcionesDeSesionVirtual(appointment)
      : {};
    await sendAppointmentNotifications(
      appointment,
      `Recordatorio: la cita inicia en ${label}.`,
      null,
      opciones
    );

    // Canal push adicional (no bloquea ni afecta el email de arriba).
    await sendReminderPush(appointment, type);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reminder handler error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const POST = withQstashSignature(handler);

