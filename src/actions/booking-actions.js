//src/actions/booking-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { getSession } from "@/actions/auth-actions"; // <--- MOVIDO AL TOP
import { revalidatePath } from "next/cache";         // <--- MOVIDO AL TOP

/**
 * Calcula los slots disponibles para un profesional en una fecha específica.
 */
export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay(); 

    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        dayOfWeek: dayOfWeek
      }
    });

    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { not: 'CANCELLED' },
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

    freeSlots.sort();

    return { success: true, slots: freeSlots };

  } catch (error) {
    console.error("Error calculando slots:", error);
    return { success: false, error: "Error al calcular disponibilidad." };
  }
}

/**
 * SOLICITAR CITA (Estado PENDING)
 */
export async function requestAppointment(professionalId, dateString, timeString, serviceId) {
  const session = await getSession();
  
  // 1. Verificar Sesión del Paciente
  if (!session || !session.user) {
    return { error: "Debes iniciar sesión para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    const startDateTime = new Date(`${dateString}T${timeString}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 60 min hardcoded por ahora

    // 2. DOBLE CHECK: Verificar que sigue libre
    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { not: 'CANCELLED' },
        OR: [
          {
            date: { lte: startDateTime },
            endDate: { gt: startDateTime }
          },
          {
            date: { lt: endDateTime },
            endDate: { gte: endDateTime }
          }
        ]
      }
    });

    if (conflict) {
      return { error: "Lo sentimos, este horario acaba de ser ocupado." };
    }

    // 3. Crear la Cita
    const appointment = await prisma.appointment.create({
      data: {
        date: startDateTime,
        endDate: endDateTime,
        status: 'PENDING',
        userId: session.userId,
        professionalId: professionalId,
        serviceId: serviceId || undefined,
      }
    });

    // 4. Revalidar
    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');
    
    return { success: true, appointmentId: appointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}