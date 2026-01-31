//src/actions/agenda-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";
import { resend } from "@/lib/resend";
import { emailCitaConfirmada } from "@/lib/email-templates";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Obtener citas del profesional (Pendientes y Confirmadas)
 * Se usa en el Dashboard del Profesional.
 */
export async function getProfessionalAppointments(professionalId) {
  // 1. Verificamos que quien pide los datos sea el dueño de la cuenta
  const session = await getSession();
  
  if (!session || session.profile.id !== professionalId) {
    throw new Error("Acceso denegado: No puedes ver la agenda de otro profesional."); 
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where: { 
        professionalId,
        status: { not: 'CANCELLED' } // Traemos pendientes y confirmadas, ignoramos canceladas históricas
      },
      include: {
        user: { 
          select: { name: true, email: true, phone: true } 
        }, 
        service: { 
          select: { title: true, price: true } 
        }
      },
      orderBy: { date: 'asc' } // Orden cronológico
    });

    return { success: true, data: appointments };

  } catch (error) {
    console.error("Error al cargar agenda:", error);
    return { success: false, error: "Error al cargar la agenda." };
  }
}

/**
 * RESPONDER SOLICITUD (Aprobar / Rechazar)
 * Actualiza el estado y notifica al paciente.
 */
export async function respondAppointment(appointmentId, action) {
  // action puede ser 'CONFIRM' o 'REJECT'
  const session = await getSession();
  
  // 1. Verificar Rol
  if (!session || session.role !== 'PROFESSIONAL') {
    return { error: "No autorizado" };
  }

  try {
    // 2. Verificar que la cita pertenezca a este profesional
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { professionalId: true }
    });

    if (!appointment || appointment.professionalId !== session.profile.id) {
      return { error: "No tienes permiso para gestionar esta cita." };
    }

    // 3. Determinar nuevo estado
    const newStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'CANCELLED_BY_PRO';

    // 4. Actualizar Base de Datos
    // Usamos 'include' para traer datos del usuario y enviar el email
    const updatedAppt = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: newStatus },
      include: { 
        user: true, 
        professional: true 
      }
    });

    // 5. ENVIAR NOTIFICACIÓN (Solo si se confirma)
    if (newStatus === 'CONFIRMED') {
      try {
        const fechaLegible = format(updatedAppt.date, "EEEE d 'de' MMMM", { locale: es });
        const horaLegible = format(updatedAppt.date, "HH:mm");

        // En modo prueba de Resend, solo envía si el 'to' es tu email verificado.
        // En producción (con dominio verificado), llegará al usuario real.
        await resend.emails.send({
          from: 'Citas <onboarding@resend.dev>',
          to: updatedAppt.user.email,
          subject: '✅ Tu cita ha sido confirmada',
          html: emailCitaConfirmada(
            updatedAppt.user.name,
            updatedAppt.professional.name,
            fechaLegible,
            horaLegible
          )
        });
      } catch (emailError) {
        console.error("Error enviando email de confirmación (No bloqueante):", emailError);
        // No retornamos error aquí para que la UI se actualice aunque falle el mail
      }
    }

    // 6. Revalidar el panel para refrescar la lista
    revalidatePath('/panel/profesional');
    
    return { success: true };

  } catch (error) {
    console.error("Error updating appointment:", error);
    return { error: "Error interno al procesar la solicitud." };
  }
}