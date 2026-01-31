//src/actions/availability-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";

export async function getAvailability() {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };

  try {
    const availability = await prisma.availability.findMany({
      where: { professionalId: session.profile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] // Ordenar por día y luego por hora
    });
    return { success: true, data: availability };
  } catch (error) {
    return { success: false, error: "Error al cargar horarios" };
  }
}

export async function updateAvailability(scheduleData) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: 'No autorizado' };

  const professionalId = session.profile.id;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Limpiamos TODO el horario previo
      await tx.availability.deleteMany({
        where: { professionalId }
      });

      // 2. Insertamos los nuevos bloques (pueden ser múltiples por día)
      if (scheduleData && scheduleData.length > 0) {
        await tx.availability.createMany({
          data: scheduleData.map(slot => ({
            professionalId,
            dayOfWeek: Number(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
          }))
        });
      }
    });

    revalidatePath('/panel/profesional');
    revalidatePath('/panel/profesional/horarios');
    return { success: true, message: 'Horarios actualizados correctamente.' };

  } catch (error) {
    console.error("Error saving availability:", error);
    return { error: 'Error interno al guardar.' };
  }
}