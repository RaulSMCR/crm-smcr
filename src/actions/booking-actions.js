//src/actions/booking-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addMinutes, format, parse, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN IMPORT
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { emailNuevaSolicitud } from "@/lib/email-templates";

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
        patientId: session.sub, // <--- CAMBIO CLAVE: patientId, no userId
        professionalId: professionalId,
        serviceId: serviceId || undefined,
        // pricePaid, commissionFee se calculan luego o al pagar
      }
    });

    // 5. Notificación (CORRECCIÓN DE SCHEMA)
    try {
      // Buscamos el perfil Y el usuario asociado para tener el email
      const proProfile = await prisma.professionalProfile.findUnique({
        where: { id: professionalId },
        include: { user: true } // <--- Necesitamos el User para el email
      });

      if (proProfile && proProfile.user?.email) {
        const fechaLegible = format(startDateTime, "EEEE d 'de' MMMM", { locale: es });
        const appUrl = process.env.NEXT_PUBLIC_URL || 'https://crm-smcr.vercel.app';

        await resend.emails.send({
          from: 'Salud Mental Costa Rica <onboarding@resend.dev>',
          to: proProfile.user.email, // <--- Email real del médico
          subject: '📅 Nueva Solicitud de Cita',
          html: emailNuevaSolicitud(
             proProfile.user.name, 
             session.name, // Nombre del paciente desde la sesión
             fechaLegible, 
             timeString, 
             `${appUrl}/panel/profesional`
          )
        });
      }
    } catch (emailError) {
      console.error("Fallo al enviar email (no bloqueante):", emailError);
    }

    revalidatePath(`/agendar/${professionalId}`);
    revalidatePath('/panel/paciente');
    
    return { success: true, appointmentId: appointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}