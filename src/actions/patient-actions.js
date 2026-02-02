//src/actions/patient-actions.js

'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; // <--- Import correcto

export async function getMyAppointments() {
  const session = await getSession();
  
  if (!session || !session.sub) {
    return { error: "No autorizado" };
  }

  try {
    // Buscamos citas donde el usuario sea el PACIENTE
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: session.sub, // <--- Usamos el ID del usuario logueado
      },
      orderBy: {
        date: 'desc' // Las más recientes primero
      },
      include: {
        // Incluimos datos del profesional para mostrar en la tarjeta
        professional: {
            include: {
                user: {
                    select: { name: true, image: true, email: true }
                }
            }
        },
        service: {
            select: { title: true, price: true }
        }
      }
    });

    // Mapeamos para "aplanar" la estructura y que sea fácil de usar en el frontend
    const cleanAppointments = appointments.map(appt => ({
        id: appt.id,
        date: appt.date,
        endDate: appt.endDate,
        status: appt.status,
        service: appt.service,
        professional: {
            name: appt.professional.user.name,
            image: appt.professional.user.image,
            email: appt.professional.user.email,
            specialty: appt.professional.specialty
        }
    }));

    return { success: true, data: cleanAppointments };

  } catch (error) {
    console.error("Error getMyAppointments:", error);
    return { error: "Error al cargar citas." };
  }
}