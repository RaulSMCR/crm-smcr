//src/actions/booking-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN IMPORT
import { revalidatePath } from "next/cache";
import { sendAppointmentNotifications, syncGoogleCalendarEvent } from "@/lib/appointments";

/**
 * Calcula los slots disponibles
 */
export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay(); 

    // A. Disponibilidad base (ProfessionalProfile -> Availability)
    const availability = await prisma.availability.findMany({
      where: {
        professionalId, // ID del Perfil
        dayOfWeek: dayOfWeek
      },
      orderBy: { startTime: 'asc' }
    });

    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    // B. Citas ocupadas (ProfessionalProfile -> Appointment)
    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: ['CANCELLED_BY_USER', 'CANCELLED_BY_PRO'] }, // Ignoramos canceladas
        date: {
          gte: startOfDay(searchDate),
          lte: endOfDay(searchDate)
        }
      },
      select: { date: true, endDate: true }
    });

    // C. Generación de Slots
    let freeSlots = [];
    const now = new Date(); 

    for (const block of availability) {
      let currentSlot = parse(`${dateString}T${block.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      const blockEnd = parse(`${dateString}T${block.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());

      while (isBefore(addMinutes(currentSlot, durationMin), addMinutes(blockEnd, 1))) {
        const slotEnd = addMinutes(currentSlot, durationMin);

        // Pasado
        if (isBefore(currentSlot, now)) {
            currentSlot = slotEnd;
            continue;
        }

        // Colisión
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

/**
 * SOLICITAR CITA
 */
export async function requestAppointment(professionalId, dateString, timeString, serviceId) {
  // 1. Verificar Sesión
  const session = await getSession();
  
  // Usamos 'sub' que es el ID del usuario en nuestro JWT estándar
  if (!session || !session.sub) {
    return { error: "Debes iniciar sesión para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    // 2. Calcular Duración Real
    let duration = 60; // Default
    if (serviceId) {
        const service = await prisma.service.findUnique({ where: { id: serviceId }});
        if (service) duration = service.durationMin;
    }

    const startDateTime = new Date(`${dateString}T${timeString}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000); 

    // 3. Race Condition Check
    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { notIn: ['CANCELLED_BY_USER', 'CANCELLED_BY_PRO'] },
        OR: [
          { date: { lte: startDateTime }, endDate: { gt: startDateTime } },
          { date: { lt: endDateTime }, endDate: { gte: endDateTime } }
        ]
      }
    });

    if (conflict) {
      return { error: "Lo sentimos, este horario acaba de ser ocupado." };
    }

    // 4. Crear Cita (CORRECCIÓN DE SCHEMA)
    const appointment = await prisma.appointment.create({
      data: {
        date: startDateTime,
        endDate: endDateTime,
        status: 'PENDING',
        patientId: session.sub,
        professionalId: professionalId,
        serviceId: serviceId || undefined,
      }
    });

    const fullAppointment = await prisma.appointment.findUnique({
      where: { id: appointment.id },
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

    if (fullAppointment) {
      await Promise.allSettled([
        syncGoogleCalendarEvent(fullAppointment),
        sendAppointmentNotifications(fullAppointment, "Se creó una nueva cita en estado pendiente."),
      ]);
    }

    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');
    
    return { success: true, appointmentId: appointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}