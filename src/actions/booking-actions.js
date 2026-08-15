'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendScheduleMeta } from "@/lib/analytics/meta-events";
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
import { createPaymentRequestForAppointment } from "@/lib/payment-requests";
import { alertarCobroNoGenerado } from "@/lib/payment-alerts";
import { getBookingOptions, resolveBookingSelection } from "@/lib/booking-rates";
import { snapshotLocation } from "@/lib/rates";

function describeRecurringConflict(conflict) {
  if (!conflict) return null;
  return {
    label: `Hay un conflicto en ${formatConflictDate(conflict.start)}.`,
    dateString: format(conflict.start, "yyyy-MM-dd"),
    occurrenceIndex: conflict.index,
  };
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
        scheduleReminder({ appointmentId: appointment.id, type: "24h", sendAt: new Date(appointmentMs - 24 * 60 * 60 * 1000) }),
        scheduleReminder({ appointmentId: appointment.id, type: "1h", sendAt: new Date(appointmentMs - 60 * 60 * 1000) }),
      ];
    })
  );
}

export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay();

    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        dayOfWeek: dayOfWeek
      },
      orderBy: { startTime: 'asc' }
    });

    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: CANCELLED_STATUSES },
        date: {
          gte: startOfDay(searchDate),
          lte: endOfDay(searchDate)
        }
      },
      select: { date: true, endDate: true }
    });

    let freeSlots = [];
    const now = new Date();

    for (const block of availability) {
      let currentSlot = parse(`${dateString}T${block.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      const blockEnd = parse(`${dateString}T${block.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());

      while (isBefore(addMinutes(currentSlot, durationMin), addMinutes(blockEnd, 1))) {
        const slotEnd = addMinutes(currentSlot, durationMin);

        if (isBefore(currentSlot, now)) {
          currentSlot = slotEnd;
          continue;
        }

        const isOccupied = appointments.some(app => {
          return (currentSlot < app.endDate) && (slotEnd > app.date);
        });

        if (!isOccupied) {
          freeSlots.push(format(currentSlot, "HH:mm"));
        }

        currentSlot = slotEnd;
      }
    }

    freeSlots = [...new Set(freeSlots)].sort();
    return { success: true, slots: freeSlots };

  } catch (error) {
    console.error("Error calculando slots:", error);
    return { success: false, error: "Error al calcular disponibilidad." };
  }
}

export async function requestAppointment(
  professionalId,
  dateString,
  timeString,
  serviceId,
  recurrenceRule,
  recurrenceCount,
  attribution = {},
  locationId = null
) {
  // Identificadores de atribución publicitaria: solo se persisten en la PRIMERA
  // cita de la serie (es la que genera el adelanto y, por tanto, la conversión).
  const gaClientId = String(attribution?.gaClientId || "").slice(0, 120) || null;
  const gaGclid = String(attribution?.gaGclid || "").slice(0, 200) || null;
  const session = await getSession();

  if (!session || !session.sub) {
    return { error: "Debe iniciar sesión para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    let duration = 60;

    if (serviceId) {
      const assignment = await prisma.serviceAssignment.findUnique({
        where: {
          professionalId_serviceId: {
            professionalId,
            serviceId,
          },
        },
        select: {
          status: true,
          service: { select: { durationMin: true } },
        },
      });

      if (!assignment || assignment.status !== "APPROVED") {
        return { error: "El servicio seleccionado no está disponible para este profesional." };
      }

      duration = assignment.service?.durationMin || 60;
    }

    const dateTimeString = `${dateString}T${timeString}:00`;
    const localDateTime = parse(dateTimeString, "yyyy-MM-dd'T'HH:mm:ss", new Date());
    const startDateTime = fromZonedTime(localDateTime, 'America/Costa_Rica');

    // El precio depende del lugar elegido y de la franja en la que cae la cita,
    // así que se resuelve recién acá, con la hora ya calculada. Se congela en la
    // cita: aunque el profesional cambie su tarifa mañana, este paciente paga lo
    // que aceptó hoy.
    let booking = { pricePaid: null, rateId: null, timeBandName: null, ...snapshotLocation(null) };

    if (serviceId) {
      const selection = await resolveBookingSelection({
        professionalId,
        serviceId,
        startsAt: startDateTime,
        locationId,
      });
      if (selection.error) return { error: selection.error };
      booking = selection.data;
    }

    const pricePaid = booking.pricePaid;
    const rule = normalizeRecurrenceRule(recurrenceRule);
    const count = rule === RECURRENCE_RULES.NONE ? 1 : normalizeRecurrenceCount(recurrenceCount);
    const starts = buildRecurringStarts(startDateTime, rule, count);
    const ends = buildOccurrenceEnds(starts, duration);

    if (starts.some((start) => start <= new Date())) {
      return { error: "Uno de los horarios de la serie ya pasó." };
    }

    const conflictError = describeRecurringConflict(
      await findRecurringConflict({ professionalId, starts, ends })
    );

    if (conflictError) {
      return {
        error: `${conflictError.label} Seleccione un horario alternativo para esa sesión.`,
        conflictInfo: {
          dateString: conflictError.dateString,
          occurrenceIndex: conflictError.occurrenceIndex,
          label: conflictError.label,
        },
      };
    }

    // Determinar si es la primera cita de este paciente con este profesional
    const previousCount = await prisma.appointment.count({
      where: {
        patientId: session.sub,
        professionalId,
        status: { notIn: CANCELLED_STATUSES },
      },
    });
    const isFirstWithProfessional = previousCount === 0;

    // Ya no se exige un enlace ONVO preconfigurado: el enlace se crea por cita,
    // con el monto congelado, en el momento de cobrar.

    const createdAppointments = await prisma.$transaction(
      starts.map((start, index) =>
        prisma.appointment.create({
          data: {
            date: start,
            endDate: ends[index],
            status: 'PENDING',
            patientId: session.sub,
            professionalId: professionalId,
            serviceId: serviceId || undefined,
            pricePaid,
            // Copia congelada de lo que el paciente aceptó: lugar, modalidad y
            // franja quedan en la cita aunque después se editen o se borren.
            rateId: booking.rateId,
            locationId: booking.locationId,
            modality: booking.modality,
            locationName: booking.locationName,
            locationAddress: booking.locationAddress,
            timeBandName: booking.timeBandName,
            isFirstWithProfessional: isFirstWithProfessional && index === 0,
            // Solo la primera cita de la serie lleva los identificadores.
            gaClientId: index === 0 ? gaClientId : null,
            gaGclid: index === 0 ? gaGclid : null,
          },
          select: { id: true }
        })
      )
    );

    const hydratedAppointments = await hydrateAppointments(createdAppointments.map((item) => item.id));
    await notifyAppointments(hydratedAppointments, "Se creó una nueva cita en estado pendiente.");

    const firstAppointment = hydratedAppointments.find((item) => item.isFirstWithProfessional);
    const depositPayment = firstAppointment && pricePaid
      ? await createPaymentRequestForAppointment(firstAppointment, "DEPOSIT_50")
      : null;
    if (depositPayment && !depositPayment.success) {
      console.error("No se pudo generar el adelanto de primera cita:", depositPayment.error);
      // La cita ya quedó reservada y el paciente no recibió enlace: sin este
      // aviso el fallo solo existe en los logs de Vercel.
      await alertarCobroNoGenerado(firstAppointment, depositPayment);
    }

    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');

    const depositAmount = firstAppointment && pricePaid
      ? Math.round(Number(pricePaid) * 0.5)
      : null;

    // Evento Schedule a Meta CAPI (fire-and-forget; no bloquea la reserva).
    // Se ancla en la primera cita creada, igual que el píxel cliente trackSchedule.
    const scheduledId = hydratedAppointments[0]?.id;
    if (scheduledId) after(() => sendScheduleMeta(scheduledId));

    return {
      success: true,
      appointmentId: hydratedAppointments[0]?.id || null,
      createdCount: hydratedAppointments.length,
      requiresDeposit: Boolean(firstAppointment && pricePaid),
      depositAmount,
      // Lo que el paciente acaba de aceptar, para confirmárselo en pantalla.
      confirmation: {
        startsAt: starts[0].toISOString(),
        durationMin: duration,
        price: pricePaid,
        locationName: booking.locationName,
        locationAddress: booking.locationAddress,
        modality: booking.modality,
        timeBandName: booking.timeBandName,
      },
    };

  } catch (error) {
    console.error("Error creating appointment:", error);
    if (isAppointmentOverlapError(error)) return { error: APPOINTMENT_OVERLAP_MESSAGE };
    return { error: "Error interno al procesar la solicitud." };
  }
}



/**
 * Modalidades y precios disponibles para un horario, para que el paciente elija
 * antes de confirmar. El precio se vuelve a resolver al crear la cita, así que
 * esto es solo para mostrar: nada de lo que devuelve se persiste tal cual.
 */
export async function getSlotOptions(professionalId, dateString, timeString, serviceId) {
  try {
    if (!professionalId || !serviceId || !dateString || !timeString) {
      return { success: true, options: [], timeBand: null };
    }

    const localDateTime = parse(
      `${dateString}T${timeString}:00`,
      "yyyy-MM-dd'T'HH:mm:ss",
      new Date()
    );
    const startsAt = fromZonedTime(localDateTime, "America/Costa_Rica");

    const { options, timeBand } = await getBookingOptions({ professionalId, serviceId, startsAt });

    // Si es su primera cita con este profesional, se le cobra el 50% por
    // adelantado y tiene que saberlo antes de confirmar.
    const session = await getSession();
    const previas = session?.sub
      ? await prisma.appointment.count({
          where: {
            patientId: String(session.sub),
            professionalId: String(professionalId),
            status: { notIn: CANCELLED_STATUSES },
          },
        })
      : null;

    return {
      success: true,
      options,
      timeBand: timeBand ? { id: timeBand.id, name: timeBand.name } : null,
      esPrimeraCita: previas === 0,
    };
  } catch (error) {
    console.error("getSlotOptions error:", error);
    return { success: false, options: [], timeBand: null, error: "No se pudieron cargar las modalidades." };
  }
}
