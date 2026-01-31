//src/actions/agenda-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { getCalendarClient } from "@/lib/google";
import { revalidatePath } from "next/cache";

// ==========================================
// SECCIÓN 1: PÚBLICA / PACIENTE (Lectura y Creación)
// ==========================================

/**
 * Trae info del profesional, sus servicios y su agenda ocupada de Google.
 */
export async function obtenerDatosAgenda(professionalId) {
  const id = Number(professionalId); // Aseguramos que sea número (si usas ID numérico en DB o string si es UUID)
  // NOTA: Si cambiaste a CUID (String) en el schema, quita el Number(). 
  // Asumiré String CUID por tu schema nuevo.
  
  try {
    // A. Buscar profesional y sus servicios en DB
    const professional = await prisma.professional.findUnique({
      where: { id: String(professionalId) }, // Aseguramos String si es CUID
      include: { services: true },
    });

    if (!professional) return { error: "Profesional no encontrado" };

    // B. Buscar ocupación en Google Calendar
    let busySlots = [];
    if (professional.googleRefreshToken) {
      const calendar = getCalendarClient(professional.googleRefreshToken);
      const timeMin = new Date();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: "primary" }],
        },
      });
      busySlots = response?.data?.calendars?.primary?.busy ?? [];
    }

    return { 
      success: true, 
      professional: {
        id: professional.id,
        name: professional.name,
        services: professional.services,
        avatarUrl: professional.avatarUrl
      },
      busy: busySlots 
    };

  } catch (error) {
    console.error("Error en obtenerDatosAgenda:", error);
    return { error: "Error al cargar la agenda." };
  }
}

/**
 * Agendar una nueva cita
 */
export async function agendarCita(formData, professionalId) {
  const serviceId = formData.get('serviceId');
  const startTime = new Date(formData.get('startTime'));

  // TODO: Obtener ID real del usuario desde la sesión
  // const session = await getSession();
  // const userId = session.profile.id;
  const userId = "USER_ID_PLACEHOLDER"; // ⚠️ REEMPLAZAR CUANDO TENGAS AUTH

  if (!serviceId || !startTime) {
    return { error: "Faltan datos para la reserva" };
  }

  try {
    // 1. Obtener detalles del servicio y profesional para calcular fin y tokens
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const professional = await prisma.professional.findUnique({ 
        where: { id: String(professionalId) },
        select: { googleRefreshToken: true, email: true }
    });

    if (!service || !professional) return { error: "Servicio o Profesional no válido" };

    // Calcular hora fin
    const endTime = new Date(startTime.getTime() + service.durationMin * 60000);

    // 2. Insertar en Google Calendar (si tiene conexión)
    let gcalEventId = null;
    if (professional.googleRefreshToken) {
        const calendar = getCalendarClient(professional.googleRefreshToken);
        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: `Cita: ${service.title}`,
                description: `Cliente ID: ${userId}`,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
            }
        });
        gcalEventId = event.data.id;
    }

    // 3. Guardar en Base de Datos
    await prisma.appointment.create({
        data: {
            date: startTime,
            endDate: endTime,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            pricePaid: service.price,
            gcalEventId: gcalEventId,
            userId: userId,
            professionalId: String(professionalId),
            serviceId: serviceId
        }
    });

    revalidatePath(`/agendar/${professionalId}`);
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: "No se pudo procesar la reserva." };
  }
}

// ==========================================
// SECCIÓN 2: GESTIÓN DE CITAS (Cancelar / Modificar)
// ==========================================

/**
 * Cancelar cita (Sirve para Usuario y Profesional)
 */
export async function cancelAppointment(appointmentId) {
  if (!appointmentId) return { error: "ID de cita requerido" };

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { professional: { select: { googleRefreshToken: true } } }
    });

    if (!appointment) return { error: "Cita no encontrada" };

    // Borrar de Google Calendar
    if (appointment.gcalEventId && appointment.professional.googleRefreshToken) {
      try {
        const calendar = getCalendarClient(appointment.professional.googleRefreshToken);
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: appointment.gcalEventId
        });
      } catch (googleError) {
        console.warn("GCal delete error (ignorable):", googleError.message);
      }
    }

    // Actualizar DB
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED_BY_USER', gcalEventId: null }
    });

    revalidatePath('/panel/paciente'); 
    revalidatePath('/panel/profesional');
    return { success: true };

  } catch (error) {
    console.error("Error cancelando cita:", error);
    return { error: "Error al cancelar." };
  }
}

// ==========================================
// SECCIÓN 3: EXCLUSIVO PROFESIONALES
// ==========================================

/**
 * Obtener listado de citas para el panel del profesional
 */
export async function getProfessionalAppointments(professionalId) {
    try {
        const appointments = await prisma.appointment.findMany({
            where: { professionalId: String(professionalId) },
            include: {
                user: { // Incluimos datos del paciente
                    select: { name: true, email: true, phone: true }
                },
                service: {
                    select: { title: true, price: true, durationMin: true }
                }
            },
            orderBy: { date: 'asc' }
        });
        return appointments;
    } catch (error) {
        console.error("Error fetching pro appointments:", error);
        return [];
    }
}

/**
 * Cambiar estado de la cita (Confirmar, Completar, Marcar Ausente)
 */
export async function updateAppointmentStatus(appointmentId, newStatus) {
    try {
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: newStatus }
        });
        
        revalidatePath('/panel/profesional');
        return { success: true };
    } catch (error) {
        return { error: "No se pudo actualizar el estado" };
    }
}