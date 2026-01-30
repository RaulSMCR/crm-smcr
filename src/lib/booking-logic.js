import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, parse, addMinutes, isBefore, isAfter, set, isEqual } from "date-fns";

/**
 * Obtiene los slots (huecos) disponibles para un profesional en una fecha específica.
 * * @param {string} professionalId - ID del profesional
 * @param {Date} targetDate - Fecha que quiere consultar el paciente (objeto Date)
 * @param {number} durationMinutes - Duración del servicio (Default: 60 mins)
 * @returns {Promise<Array>} - Array de objetos { time: "10:00", iso: "2024-..." }
 */
export async function getAvailableSlots(professionalId, targetDate, durationMinutes = 60) {
  // 1. Determinar qué día de la semana es (0=Domingo, 1=Lunes...)
  const dayOfWeek = targetDate.getDay();

  // 2. Buscar la regla de disponibilidad para ese día específico
  const availability = await prisma.availability.findFirst({
    where: {
      professionalId,
      dayOfWeek: dayOfWeek,
      isActive: true,
    },
  });

  // Si el profesional no trabaja ese día, retornamos vacío
  if (!availability) return [];

  // 3. Buscar citas YA ocupadas ese día para restarlas
  // Asumimos que 'date' en Appointment es el inicio de la cita
  const startDay = startOfDay(targetDate);
  const endDay = endOfDay(targetDate);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      date: {
        gte: startDay,
        lte: endDay,
      },
      status: { not: 'CANCELLED' } // Ignoramos las canceladas
    },
    select: { date: true } // Solo necesitamos saber cuándo empiezan
  });

  // 4. Generar todos los slots posibles según la regla horaria (ej: 09:00 a 17:00)
  const slots = [];
  
  // Parsear horas de inicio y fin desde el string "HH:mm" (ej: "09:00")
  // Usamos una fecha base arbitraria porque solo nos importa la hora
  const ruleStart = parse(availability.startTime, 'HH:mm', targetDate);
  const ruleEnd = parse(availability.endTime, 'HH:mm', targetDate);

  let currentSlot = ruleStart;

  // Bucle: Mientras el slot actual + duración <= hora de fin
  while (isBefore(addMinutes(currentSlot, durationMinutes), ruleEnd) || isEqual(addMinutes(currentSlot, durationMinutes), ruleEnd)) {
    
    // 5. Verificación de Colisiones (El paso crítico)
    const isOccupied = existingAppointments.some(appt => {
      // Calculamos el rango de la cita existente
      const apptStart = new Date(appt.date);
      const apptEnd = addMinutes(apptStart, durationMinutes); // Asumimos misma duración por ahora

      // El slot actual que intentamos generar
      const slotStart = currentSlot;
      const slotEnd = addMinutes(currentSlot, durationMinutes);

      // Lógica de solapamiento de rangos:
      // (StartA < EndB) y (EndA > StartB)
      return isBefore(slotStart, apptEnd) && isAfter(slotEnd, apptStart);
    });

    // 6. Verificación de Tiempo Pasado (No mostrar slots de hace 1 hora si es hoy)
    const now = new Date();
    const isPast = isBefore(currentSlot, now);

    // Si no está ocupado y no es pasado, lo agregamos
    if (!isOccupied && !isPast) {
      slots.push({
        time: currentSlot.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        iso: currentSlot.toISOString() // Formato seguro para guardar en DB después
      });
    }

    // Avanzar al siguiente bloque
    currentSlot = addMinutes(currentSlot, durationMinutes);
  }

  return slots;
}