//Abre src/actions/availability-actions.js.
'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN: Import directo desde la librería
import { revalidatePath } from "next/cache";

export async function getAvailability() {
  const session = await getSession();
  
  // Verificación estricta
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };

  // 2. CORRECCIÓN: Usar el ID del nuevo token plano
  const professionalId = session.professionalId;

  try {
    const availability = await prisma.availability.findMany({
      where: { professionalId: professionalId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    return { success: true, data: availability };
  } catch (error) {
    console.error("Error getAvailability:", error);
    return { success: false, error: "Error al cargar horarios" };
  }
}

export async function updateAvailability(scheduleData) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: 'No autorizado' };

  // 2. CORRECCIÓN: Usar el ID correcto
  const professionalId = session.professionalId;

  try {
    // Usamos una transacción para asegurar que no queden horarios "huérfanos" si algo falla
    await prisma.$transaction(async (tx) => {
      // A. Limpiamos TODO el horario previo de este profesional
      await tx.availability.deleteMany({
        where: { professionalId }
      });

      // B. Insertamos los nuevos bloques
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