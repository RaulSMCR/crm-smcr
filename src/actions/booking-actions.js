//src/actions/booking-actions.js

'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";

/**
 * Calcula los slots disponibles para un profesional en una fecha específica.
 * @param {string} professionalId 
 * @param {string} dateString - Formato "YYYY-MM-DD" (ej: "2025-10-25")
 * @param {number} durationMin - Duración de la cita (por defecto 60 min)
 */
export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    // 1. Configurar fechas base
    // Creamos la fecha en zona horaria local del servidor (asumimos consistencia)
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay(); // 0=Domingo, 1=Lunes...

    // 2. Obtener Reglas de Disponibilidad para ese día de la semana
    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        dayOfWeek: dayOfWeek
      }
    });

    // Si no trabaja ese día, retornamos vacío rápido
    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    // 3. Obtener Citas YA ocupadas en esa fecha específica
    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        status: { not: 'CANCELLED' }, // Ignoramos las canceladas
        date: {
          gte: startOfDay(searchDate),
          lte: endOfDay(searchDate)
        }
      },
      select: { date: true, endDate: true }
    });

    // 4. Generar Slots Libres (El Algoritmo)
    let freeSlots = [];
    const now = new Date(); // Para no mostrar horarios pasados si es "hoy"

    // Recorremos cada bloque de disponibilidad (ej: Mañana y Tarde)
    for (const block of availability) {
      // Parsear horas de inicio y fin del bloque (ej: "09:00")
      // Usamos la fecha searchDate para combinarla con la hora
      let currentSlot = parse(`${dateString}T${block.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      const blockEnd = parse(`${dateString}T${block.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());

      // Mientras el slot + duración no se pase del fin del bloque
      while (isBefore(addMinutes(currentSlot, durationMin), addMinutes(blockEnd, 1))) { // +1 minuto de margen
        
        const slotEnd = addMinutes(currentSlot, durationMin);

        // A. Chequeo de Pasado: Si la fecha es hoy, el slot debe ser futuro
        if (isBefore(currentSlot, now)) {
            currentSlot = slotEnd; // Saltamos al siguiente
            continue;
        }

        // B. Chequeo de Colisión: ¿Choca con alguna cita existente?
        const isOccupied = appointments.some(app => {
            // Un slot choca si:
            // (SlotStart < AppEnd) Y (SlotEnd > AppStart)
            return (currentSlot < app.endDate) && (slotEnd > app.date);
        });

        if (!isOccupied) {
          freeSlots.push(format(currentSlot, "HH:mm"));
        }

        // Avanzamos al siguiente slot
        currentSlot = slotEnd;
      }
    }

    // Ordenamos los slots cronológicamente
    freeSlots.sort();

    return { success: true, slots: freeSlots };

  } catch (error) {
    console.error("Error calculando slots:", error);
    return { success: false, error: "Error al calcular disponibilidad." };
  }
  import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";

// ... (mantén la función getAvailableSlots que ya tenías arriba) ...

/**
 * SOLICITAR CITA (Estado PENDING)
 */
export async function requestAppointment(professionalId, dateString, timeString, serviceId) {
  // 1. Verificar Sesión del Paciente
  const session = await getSession();
  if (!session || !session.user) {
    return { error: "Debes iniciar sesión para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    // 2. Construir la fecha completa (ISO)
    // dateString es "2025-10-25", timeString es "09:00"
    const startDateTime = new Date(`${dateString}T${timeString}:00`);
    
    // Calculamos fin (asumimos 60 min por defecto o buscamos servicio)
    // Para simplificar ahora, usamos 60 min fijos. 
    // Idealmente harías un prisma.service.findUnique para sacar la duración.
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000);

    // 3. DOBLE CHECK: Verificar que sigue libre (Race Condition)
    const conflict = await prisma.appointment.findFirst({
      where: {
        professionalId,
        status: { not: 'CANCELLED' }, // Ni confirmada ni pendiente de otro
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

    // 4. Crear la Cita
    const appointment = await prisma.appointment.create({
      data: {
        date: startDateTime,
        endDate: endDateTime,
        status: 'PENDING', // <--- CLAVE: El profesional debe aprobarla
        userId: session.userId,
        professionalId: professionalId,
        serviceId: serviceId || undefined, // Opcional si vienes de una página genérica
      }
    });

    // 5. Revalidar
    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');
    
    return { success: true, appointmentId: appointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}
}