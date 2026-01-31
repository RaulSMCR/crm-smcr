//src/actions/patient-actions.js

'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export async function getMyAppointments() {
  const session = await getSession();
  
  // 1. Verificar sesión
  if (!session || !session.user) {
    return { error: "No autorizado", data: [] };
  }

  try {
    // 2. Buscar citas del usuario logueado
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: session.userId,
        status: { not: 'CANCELLED' } // Opcional: si quieres mostrar historial, quita esto
      },
      include: {
        professional: {
          select: {
            name: true,
            specialty: true,
            avatarUrl: true,
          }
        },
        service: {
          select: {
            title: true,
            price: true
          }
        }
      },
      orderBy: {
        date: 'desc' // Las más recientes (o futuras) primero
      }
    });

    return { success: true, data: appointments };

  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    return { success: false, error: "Error al cargar tus citas", data: [] };
  }
}