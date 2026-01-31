//src/actions/appointment-actions.js

'use server'

import { prisma } from "@/lib/prisma";

export async function getUserAppointments(userId) {
  if (!userId) return [];

  try {
    const appointments = await prisma.appointment.findMany({
      where: { userId: userId },
      include: {
        professional: {
          select: { name: true, avatarUrl: true } // Traemos solo lo necesario
        },
        service: {
          select: { title: true, price: true }
        }
      },
      orderBy: { date: 'asc' } // Las más próximas primero
    });

    return appointments;
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return [];
  }
}