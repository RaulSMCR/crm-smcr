import { format } from "date-fns";
import { es } from "date-fns/locale";
import { resend } from "@/lib/resend";
import { getCalendarClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";

const TZ = process.env.APP_TIMEZONE || "America/Costa_Rica";
const FROM_EMAIL = process.env.NOTIFICATIONS_FROM_EMAIL || "Salud Mental Costa Rica <onboarding@resend.dev>";

const CANCELLED_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  NO_SHOW: "No asistió",
  CANCELLED_BY_USER: "Cancelada por paciente",
  CANCELLED_BY_PRO: "Cancelada por profesional",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function buildNotificationHtml({ recipientName, appointment, reason }) {
  const start = new Date(appointment.date);
  const end = new Date(appointment.endDate);

  const fecha = format(start, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const horaInicio = format(start, "HH:mm", { locale: es });
  const horaFin = format(end, "HH:mm", { locale: es });

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.4;color:#0f172a;">
      <h2 style="margin-bottom:4px;">Actualización de cita</h2>
      <p>Hola ${recipientName || ""},</p>
      <p>${reason}</p>
      <ul>
        <li><strong>Servicio:</strong> ${appointment.service?.title || "Consulta"}</li>
        <li><strong>Profesional:</strong> ${appointment.professional?.user?.name || "N/D"}</li>
        <li><strong>Paciente:</strong> ${appointment.patient?.name || "N/D"}</li>
        <li><strong>Fecha:</strong> ${fecha}</li>
        <li><strong>Horario:</strong> ${horaInicio} - ${horaFin} (${TZ})</li>
        <li><strong>Estado:</strong> ${getStatusLabel(appointment.status)}</li>
      </ul>
      <p style="font-size:12px;color:#475569;">Este correo fue generado automáticamente por el sistema de agenda.</p>
    </div>
  `;
}

export async function sendAppointmentNotifications(appointment, reason) {
  const patientEmail = appointment.patient?.email;
  const proEmail = appointment.professional?.user?.email;

  if (!process.env.RESEND_API_KEY) return;

  const deliveries = [];

  if (patientEmail) {
    deliveries.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: patientEmail,
        subject: "Actualización de tu cita",
        html: buildNotificationHtml({ recipientName: appointment.patient?.name, appointment, reason }),
      })
    );
  }

  if (proEmail) {
    deliveries.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: proEmail,
        subject: "Actualización de agenda",
        html: buildNotificationHtml({ recipientName: appointment.professional?.user?.name, appointment, reason }),
      })
    );
  }

  await Promise.allSettled(deliveries);
}

function buildGoogleEvent(appointment) {
  const title = `${appointment.service?.title || "Consulta"} - ${appointment.patient?.name || "Paciente"}`;
  const description = [
    `Estado CRM: ${getStatusLabel(appointment.status)}`,
    `Paciente: ${appointment.patient?.name || "N/D"}`,
    appointment.patient?.email ? `Email paciente: ${appointment.patient.email}` : null,
    `Profesional: ${appointment.professional?.user?.name || "N/D"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: title,
    description,
    start: {
      dateTime: new Date(appointment.date).toISOString(),
      timeZone: TZ,
    },
    end: {
      dateTime: new Date(appointment.endDate).toISOString(),
      timeZone: TZ,
    },
    attendees: [
      appointment.patient?.email ? { email: appointment.patient.email, displayName: appointment.patient?.name || "Paciente" } : null,
      appointment.professional?.user?.email
        ? { email: appointment.professional.user.email, displayName: appointment.professional?.user?.name || "Profesional" }
        : null,
    ].filter(Boolean),
  };
}

export async function syncGoogleCalendarEvent(appointment) {
  const refreshToken = appointment.professional?.googleRefreshToken;
  if (!refreshToken) return;

  try {
    const calendar = getCalendarClient(refreshToken);

    if (CANCELLED_STATUSES.has(appointment.status)) {
      if (appointment.gcalEventId) {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: appointment.gcalEventId,
        });

        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { gcalEventId: null, meetLink: null },
        });
      }
      return;
    }

    const payload = buildGoogleEvent(appointment);

    if (appointment.gcalEventId) {
      const updated = await calendar.events.patch({
        calendarId: "primary",
        eventId: appointment.gcalEventId,
        requestBody: payload,
        sendUpdates: "all",
      });

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          meetLink: updated.data.hangoutLink || updated.data.htmlLink || appointment.meetLink || null,
        },
      });
      return;
    }

    const created = await calendar.events.insert({
      calendarId: "primary",
      requestBody: payload,
      sendUpdates: "all",
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        gcalEventId: created.data.id || null,
        meetLink: created.data.hangoutLink || created.data.htmlLink || null,
      },
    });
  } catch (error) {
    console.error("Error sincronizando evento con Google Calendar:", error);
  }
}
