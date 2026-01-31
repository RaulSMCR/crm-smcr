//src/actions/booking-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { emailNuevaSolicitud } from "@/lib/email-templates";

/**
 * Calcula los slots disponibles para un profesional en una fecha específica.
 * @param {string} professionalId 
 * @param {string} dateString - Formato "YYYY-MM-DD"
 * @param {number} durationMin - Duración de la cita (por defecto 60 min)
 */
export async function getAvailableSlots(professionalId, dateString, durationMin = 60) {
  try {
    // 1. Configurar fechas base
    const searchDate = new Date(dateString + "T00:00:00");
    const dayOfWeek = searchDate.getDay(); // 0=Domingo, 1=Lunes...

    // 2. Obtener Reglas de Disponibilidad para ese día
    const availability = await prisma.availability.findMany({
      where: {
        professionalId,
        dayOfWeek: dayOfWeek
      },
      orderBy: { startTime: 'asc' }
    });

    // Si no trabaja ese día, retornamos vacío
    if (!availability || availability.length === 0) {
      return { success: true, slots: [] };
    }

    // 3. Obtener Citas YA ocupadas en esa fecha
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

    // 4. Generar Slots Libres (Algoritmo de Colisión)
    let freeSlots = [];
    const now = new Date(); // Para no mostrar horarios pasados si es "hoy"

    for (const block of availability) {
      // Parsear horas del bloque (ej: "09:00" a Date objeto)
      let currentSlot = parse(`${dateString}T${block.startTime}`, "yyyy-MM-dd'T'HH:mm", new Date());
      const blockEnd = parse(`${dateString}T${block.endTime}`, "yyyy-MM-dd'T'HH:mm", new Date());

      // Mientras el slot + duración entre en el bloque
      while (isBefore(addMinutes(currentSlot, durationMin), addMinutes(blockEnd, 1))) {
        
        const slotEnd = addMinutes(currentSlot, durationMin);

        // A. Chequeo de Pasado
        if (isBefore(currentSlot, now)) {
            currentSlot = slotEnd;
            continue;
        }

        // B. Chequeo de Colisión con citas existentes
        const isOccupied = appointments.some(app => {
            // Un slot choca si se solapa con una cita
            return (currentSlot < app.endDate) && (slotEnd > app.date);
        });

        if (!isOccupied) {
          freeSlots.push(format(currentSlot, "HH:mm"));
        }

        // Avanzamos al siguiente slot
        currentSlot = slotEnd;
      }
    }

    // Ordenar cronológicamente y eliminar duplicados si los hubiera
    freeSlots = [...new Set(freeSlots)].sort();

    return { success: true, slots: freeSlots };

  } catch (error) {
    console.error("Error calculando slots:", error);
    return { success: false, error: "Error al calcular disponibilidad." };
  }
}

/**
 * SOLICITAR CITA (Estado PENDING)
 * Verifica sesión, conflictos y envía notificación.
 */
export async function requestAppointment(professionalId, dateString, timeString, serviceId) {
  // 1. Verificar Sesión del Paciente
  const session = await getSession();
  if (!session || !session.user) {
    return { error: "Debes iniciar sesión para agendar.", errorCode: "UNAUTHENTICATED" };
  }

  try {
    // 2. Construir fechas
    const startDateTime = new Date(`${dateString}T${timeString}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 60 min hardcoded por ahora

    // 3. DOBLE CHECK: Verificar conflicto (Race Condition)
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

    // 4. Crear la Cita en DB
    const appointment = await prisma.appointment.create({
      data: {
        date: startDateTime,
        endDate: endDateTime,
        status: 'PENDING', // Requiere aprobación
        userId: session.userId,
        professionalId: professionalId,
        serviceId: serviceId || undefined,
      }
    });

    // 5. ENVIAR NOTIFICACIÓN AL PROFESIONAL (Resend)
    try {
      const pro = await prisma.professional.findUnique({
        where: { id: professionalId },
        select: { email: true, name: true }
      });

      if (pro && pro.email) {
        const fechaLegible = format(startDateTime, "EEEE d 'de' MMMM", { locale: es });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-smcr.vercel.app'; // Fallback a URL producción

        await resend.emails.send({
          from: 'Citas <onboarding@resend.dev>', // Cambia esto si verificaste dominio
          to: pro.email, // En modo prueba solo llega si es tu email registrado
          subject: '📅 Nueva Solicitud de Cita',
          html: emailNuevaSolicitud(
             pro.name, 
             session.user.name, 
             fechaLegible, 
             timeString, 
             `${appUrl}/panel/profesional`
          )
        });
      }
    } catch (emailError) {
      console.error("Fallo al enviar email (no bloqueante):", emailError);
    }

    // 6. Revalidar caché
    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');
    
    return { success: true, appointmentId: appointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}