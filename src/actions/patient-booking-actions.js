"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/actions/auth-actions";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";
import { scheduleReminder } from "@/lib/qstash";
import {
  buildRecurringStarts,
  normalizeRecurrenceCount,
  normalizeRecurrenceRule,
  RECURRENCE_RULES,
} from "@/lib/appointment-recurrence";
import { APPOINTMENT_OVERLAP_MESSAGE, isAppointmentOverlapError } from "@/lib/appointment-errors";
import {
  buildOccurrenceEnds,
  CANCELLED_APPOINTMENT_STATUSES as CANCELLED_STATUSES,
  findRecurringConflict,
  formatConflictDate,
} from "@/lib/booking-conflicts";
import { createPaymentRequestForAppointment, splitFirstAppointmentAmount } from "@/lib/payment-requests";
import { getBookingOptions, resolveBookingSelection } from "@/lib/booking-rates";

function describeRecurringConflict(conflict) {
  if (!conflict) return null;
  return `Ese horario ya está ocupado el ${formatConflictDate(conflict.start)}. Ajustá la serie y probá de nuevo.`;
}

async function hydrateAppointments(appointmentIds) {
  if (!appointmentIds.length) return [];

  return prisma.appointment.findMany({
    where: { id: { in: appointmentIds } },
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
    orderBy: { date: "asc" },
  });
}

async function notifyAppointments(appointments, reason) {
  await Promise.allSettled(
    appointments.flatMap((appointment) => {
      const appointmentMs = appointment.date.getTime();
      return [
        syncGoogleCalendarEvent(appointment),
        sendAppointmentNotifications(appointment, reason),
        scheduleReminder({
          appointmentId: appointment.id,
          type: "24h",
          sendAt: new Date(appointmentMs - 24 * 60 * 60 * 1000),
        }),
        scheduleReminder({
          appointmentId: appointment.id,
          type: "1h",
          sendAt: new Date(appointmentMs - 60 * 60 * 1000),
        }),
      ];
    })
  );
}

export async function createAppointmentForPatient({
  professionalId,
  serviceId,
  startISO,
  recurrenceRule,
  recurrenceCount,
  locationId = null,
}) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Debe iniciar sesión." };
    if (session.role !== "USER") return { success: false, error: "No autorizado." };

    const patientId = String(session.sub);
    const pid = String(professionalId || "");
    const sid = String(serviceId || "");
    const start = new Date(String(startISO || ""));
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

    if (!pid || !sid || Number.isNaN(start.getTime())) {
      return { success: false, error: "Datos inválidos para agendar." };
    }
    if (start < new Date()) {
      return { success: false, error: "El horario seleccionado ya pasó." };
    }

    const [service, professional, assignment] = await Promise.all([
      prisma.service.findUnique({
        where: { id: sid },
        select: { id: true, durationMin: true, price: true, isActive: true },
      }),
      prisma.professionalProfile.findUnique({
        where: { id: pid },
        select: { id: true, isApproved: true, user: { select: { isActive: true } } },
      }),
      prisma.serviceAssignment.findUnique({
        where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
        select: { status: true },
      }),
    ]);

    if (!service || !service.isActive) return { success: false, error: "Servicio no disponible." };
    if (!professional || !professional.isApproved || !professional.user?.isActive) {
      return { success: false, error: "Profesional no disponible." };
    }
    if (!assignment || assignment.status !== "APPROVED") {
      return { success: false, error: "Este profesional no está habilitado para este servicio." };
    }

    // Precio según el lugar elegido y la franja de la hora reservada. Se congela
    // en la cita, así que un cambio de tarifa posterior no la afecta.
    const selection = await resolveBookingSelection({
      professionalId: pid,
      serviceId: sid,
      startsAt: start,
      locationId,
    });
    if (selection.error) return { success: false, error: selection.error };
    const booking = selection.data;

    const starts = buildRecurringStarts(start, rule, count);
    const ends = buildOccurrenceEnds(starts, service.durationMin);

    if (starts.some((occurrence) => occurrence <= new Date())) {
      return { success: false, error: "Uno de los horarios de la serie ya pasó." };
    }

    const conflictError = describeRecurringConflict(
      await findRecurringConflict({ professionalId: pid, starts, ends })
    );

    if (conflictError) return { success: false, error: conflictError };

    const previousCount = await prisma.appointment.count({
      where: {
        patientId,
        professionalId: pid,
        status: { notIn: CANCELLED_STATUSES },
      },
    });
    const isFirstWithProfessional = previousCount === 0;

    // El enlace ONVO ya no se preconfigura: se crea por cita al momento de cobrar,
    // con el monto congelado de esa cita.

    const createdAppointments = await prisma.$transaction(
      starts.map((occurrence, index) =>
        prisma.appointment.create({
          data: {
            patientId,
            professionalId: pid,
            serviceId: sid,
            date: occurrence,
            endDate: ends[index],
            status: "PENDING",
            paymentStatus: "UNPAID",
            pricePaid: booking.pricePaid,
            rateId: booking.rateId,
            locationId: booking.locationId,
            modality: booking.modality,
            locationName: booking.locationName,
            locationAddress: booking.locationAddress,
            timeBandName: booking.timeBandName,
            isFirstWithProfessional: isFirstWithProfessional && index === 0,
          },
          select: { id: true },
        })
      )
    );

    const hydratedAppointments = await hydrateAppointments(createdAppointments.map((item) => item.id));
    await notifyAppointments(hydratedAppointments, "Se creó una nueva cita en estado pendiente.");

    const firstAppointment = hydratedAppointments.find((item) => item.isFirstWithProfessional);
    const depositPayment = firstAppointment
      ? await createPaymentRequestForAppointment(firstAppointment, "DEPOSIT_50")
      : null;

    // Que el cobro falle en silencio es lo peor que puede pasar acá: el paciente
    // ve su cita agendada, nunca recibe el enlace, y nadie se entera hasta que
    // alguien revisa los logs. Se avisa al admin y se le dice al paciente que
    // el enlace no salió, sin deshacer la cita: el horario ya está reservado.
    if (depositPayment && !depositPayment.success) {
      console.error(
        `[agenda] Cita ${firstAppointment.id} creada SIN cobro de adelanto ` +
          `(${depositPayment.code || "sin código"}): ${depositPayment.error}`
      );
      await alertarCobroNoGenerado(firstAppointment, depositPayment).catch((e) =>
        console.error("[agenda] Falló también la alerta al admin:", e)
      );
    }

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");

    return {
      success: true,
      appointmentId: hydratedAppointments[0]?.id || null,
      createdCount: hydratedAppointments.length,
      // Lo que el paciente aceptó, para confirmárselo en pantalla. El adelanto
      // se informa aparte porque cambia lo que tiene que hacer a continuación:
      // esperar el correo con el enlace de pago.
      requiresDeposit: Boolean(firstAppointment && booking.pricePaid),
      depositLinkSent: depositPayment ? Boolean(depositPayment.success) : null,
      depositError: depositPayment && !depositPayment.success ? depositPayment.error : null,
      depositAmount: firstAppointment && booking.pricePaid
        ? splitFirstAppointmentAmount(booking.pricePaid).deposit
        : null,
      confirmation: {
        startsAt: starts[0].toISOString(),
        durationMin: service.durationMin,
        price: booking.pricePaid,
        locationName: booking.locationName,
        locationAddress: booking.locationAddress,
        modality: booking.modality,
        timeBandName: booking.timeBandName,
      },
    };
  } catch (error) {
    console.error("createAppointmentForPatient error:", error);
    if (isAppointmentOverlapError(error)) return { success: false, error: APPOINTMENT_OVERLAP_MESSAGE };
    return { success: false, error: "Error interno al agendar. Por favor, intente nuevamente." };
  }
}

export async function cancelAppointmentByPatient(appointmentId, reason) {
  try {
    const session = await getSession();
    if (!session) return { error: "No autorizado: sesión requerida." };
    if (session.role !== "USER") return { error: "No autorizado." };

    const patientId = String(session.sub);
    const id = String(appointmentId || "");

    if (!id) return { error: "ID de cita inválido." };
    if (!reason || !String(reason).trim()) return { error: "Debe indicar el motivo de cancelación." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        service: true,
        patient: true,
      },
    });

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.patientId !== patientId) return { error: "No es posible cancelar citas de otros usuarios." };
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita no puede cancelarse (estado inválido)." };
    }

    const now = new Date();
    const hoursUntilAppointment = (new Date(appointment.date) - now) / (1000 * 60 * 60);
    const isLateCancel = hoursUntilAppointment < 24;

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED_BY_USER",
        cancelReason: String(reason).trim(),
        canceledBy: "PATIENT",
        canceledAt: now,
      },
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

    await Promise.allSettled([
      syncGoogleCalendarEvent(updated),
      sendAppointmentNotifications(updated, "La cita fue cancelada por el paciente."),
    ]);

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");
    return { success: true, isLateCancel };
  } catch (error) {
    console.error("cancelAppointmentByPatient error:", error);
    return { error: "Error interno al cancelar. Por favor, intente nuevamente." };
  }
}

export async function getAppointmentRescheduleData(appointmentId) {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: String(appointmentId || "") },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        include: {
          availability: true,
          appointments: {
            where: {
              id: { not: String(appointmentId || "") },
              status: { notIn: CANCELLED_STATUSES },
              date: { gte: new Date() },
            },
            select: { date: true, endDate: true },
          },
        },
      },
    },
  });

  if (!appointment) return { error: "Cita no encontrada." };
  if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };

  return {
    professionalId: appointment.professionalId,
    durationMin: appointment.service?.durationMin ?? 60,
    availability: appointment.professional.availability,
    booked: appointment.professional.appointments.map((item) => ({
      startISO: item.date.toISOString(),
      endISO: item.endDate.toISOString(),
    })),
  };
}

export async function rescheduleAppointmentByPatient(
  appointmentId,
  newStartISO,
  recurrenceRule,
  recurrenceCount
) {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const id = String(appointmentId || "");
  if (!id) return { error: "ID de cita inválido." };

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: { select: { durationMin: true } },
      professional: {
        include: { user: { select: { name: true, email: true } } },
      },
      patient: { select: { name: true, email: true } },
    },
  });

  if (!appointment) return { error: "Cita no encontrada." };
  if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };
  if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
    return { error: "Esta cita no puede reagendarse." };
  }

  const newStart = new Date(String(newStartISO || ""));
  const rule = normalizeRecurrenceRule(recurrenceRule);
  const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);

  if (Number.isNaN(newStart.getTime()) || newStart <= new Date()) {
    return { error: "Horario inválido." };
  }

  const durationMin = appointment.service?.durationMin ?? 60;
  const starts = buildRecurringStarts(newStart, rule, count);
  const ends = buildOccurrenceEnds(starts, durationMin);

  const conflictError = describeRecurringConflict(
    await findRecurringConflict({
      professionalId: appointment.professionalId,
      starts,
      ends,
      ignoreAppointmentId: id,
    })
  );

  if (conflictError) return { error: conflictError };

  const extraStarts = starts.slice(1);
  const extraEnds = ends.slice(1);

  let changedAppointments;
  try {
    changedAppointments = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          date: starts[0],
          endDate: ends[0],
          status: "PENDING",
          lastRescheduledBy: "PATIENT",
          lastRescheduledAt: new Date(),
          rescheduleCount: { increment: 1 },
        },
        select: { id: true },
      });

    const createdAppointments = [];
    for (let index = 0; index < extraStarts.length; index += 1) {
        const createdAppointment = await tx.appointment.create({
          data: {
            patientId: appointment.patientId,
            professionalId: appointment.professionalId,
            serviceId: appointment.serviceId || undefined,
            date: extraStarts[index],
            endDate: extraEnds[index],
            status: "PENDING",
            paymentStatus: appointment.paymentStatus,
            pricePaid: appointment.pricePaid,
            lastRescheduledBy: "PATIENT",
            lastRescheduledAt: new Date(),
            rescheduleCount: 1,
          },
          select: { id: true },
        });
      createdAppointments.push(createdAppointment);
    }

    return [updatedAppointment, ...createdAppointments];
    });
  } catch (error) {
    console.error("rescheduleAppointmentByPatient error:", error);
    if (isAppointmentOverlapError(error)) return { error: APPOINTMENT_OVERLAP_MESSAGE };
    return { error: "No se pudo reagendar la cita. Por favor, intente nuevamente." };
  }

  const hydratedAppointments = await hydrateAppointments(changedAppointments.map((item) => item.id));
  await notifyAppointments(hydratedAppointments, "La cita fue reagendada por el paciente.");

  revalidatePath("/panel/paciente");
  revalidatePath("/panel/profesional/citas");
  return { success: true, createdCount: hydratedAppointments.length };
}

export async function confirmCurrentAppointmentByPatient(appointmentId) {
  try {
    const session = await getSession();
    if (!session || session.role !== "USER") return { error: "No autorizado." };

    const id = String(appointmentId || "");
    if (!id) return { error: "ID de cita inválido." };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
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

    if (!appointment) return { error: "Cita no encontrada." };
    if (appointment.patientId !== String(session.sub)) return { error: "No autorizado." };
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return { error: "Esta cita ya no admite confirmación de horario." };
    }

    // Actualizar estado a CONFIRMED en DB
    const confirmed = await prisma.appointment.update({
      where: { id },
      data: { status: "CONFIRMED" },
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

    await sendAppointmentNotifications(
      confirmed,
      "El paciente confirmó la cita."
    );

    revalidatePath("/panel/paciente");
    revalidatePath("/panel/profesional/citas");
    return { success: true };
  } catch (error) {
    console.error("confirmCurrentAppointmentByPatient error:", error);
    return { error: "No se pudo registrar la confirmación." };
  }
}




/**
 * Modalidades disponibles y su precio para un horario concreto.
 * Solo para mostrar: al crear la cita el precio se vuelve a resolver en el
 * servidor, así que un cliente manipulado no puede fijar su propio monto.
 */
export async function getSlotOptionsForPatient({ professionalId, serviceId, startISO }) {
  try {
    const session = await getSession();
    if (!session) return { success: false, options: [], error: "Debe iniciar sesión." };

    const start = new Date(String(startISO || ""));
    if (!professionalId || !serviceId || Number.isNaN(start.getTime())) {
      return { success: true, options: [], timeBand: null };
    }

    const { options, timeBand } = await getBookingOptions({
      professionalId: String(professionalId),
      serviceId: String(serviceId),
      startsAt: start,
    });

    // La primera cita con un profesional se reserva pagando el 50% por
    // adelantado. El paciente tiene que saberlo ANTES de confirmar, no
    // enterarse cuando le llega el correo de cobro.
    const previas = await prisma.appointment.count({
      where: {
        patientId: String(session.sub),
        professionalId: String(professionalId),
        status: { notIn: CANCELLED_STATUSES },
      },
    });

    return {
      success: true,
      options,
      timeBand: timeBand ? { id: timeBand.id, name: timeBand.name } : null,
      esPrimeraCita: previas === 0,
    };
  } catch (error) {
    console.error("getSlotOptionsForPatient error:", error);
    return { success: false, options: [], timeBand: null, error: "No se pudieron cargar las modalidades." };
  }
}


/**
 * Avisa al administrador que una cita quedó agendada sin su orden de cobro.
 *
 * Se manda por separado del flujo de la cita para que un fallo del correo no
 * tumbe la reserva: el horario ya está tomado y perderlo sería peor.
 */
async function alertarCobroNoGenerado(appointment, resultado) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!to || !process.env.RESEND_API_KEY) return;

  const { resend } = await import("@/lib/resend");
  const cuando = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    dateStyle: "full",
    timeStyle: "short",
  }).format(appointment.date);

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>",
    to,
    subject: "⚠ Cita agendada sin orden de cobro",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
        <h2 style="color:#b91c1c;">Cita sin enlace de pago</h2>
        <p>Se agendó una cita pero <strong>no se pudo generar el cobro</strong>. El paciente
           no recibió enlace de pago y la cita quedó reservada igual.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 8px;color:#64748b;width:150px;">Paciente</td>
              <td style="padding:6px 8px;">${appointment.patient?.name || "—"} &lt;${appointment.patient?.email || "—"}&gt;</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Profesional</td>
              <td style="padding:6px 8px;">${appointment.professional?.user?.name || "—"}</td></tr>
          <tr><td style="padding:6px 8px;color:#64748b;">Cita</td>
              <td style="padding:6px 8px;">${cuando}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Motivo</td>
              <td style="padding:6px 8px;font-weight:600;">${resultado.code || ""} ${resultado.error || ""}</td></tr>
        </table>
        <p style="font-size:13px;color:#475569;">Acción: generar el cobro a mano desde el panel,
           o corregir la configuración y reintentar.</p>
      </div>`,
  });
}
