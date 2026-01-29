'use server'

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth'; // Tu librería jose
import { revalidatePath } from 'next/cache';

/**
 * Guarda la disponibilidad semanal del profesional.
 * Estrategia: Borrón y cuenta nueva (Delete All + Create Many) para la semana.
 * * @param {Array} scheduleData - Array de objetos: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, ...]
 */
export async function updateAvailability(scheduleData) {
  // 1. Verificar Autenticación
  const cookieStore = cookies();
  const token = cookieStore.get('sessionToken')?.value;

  if (!token) {
    return { error: 'No se encontró sesión activa.' };
  }

  let session;
  try {
    session = await verifyToken(token);
  } catch (error) {
    return { error: 'Sesión inválida o expirada.' };
  }

  // 2. Verificar Rol
  if (!session || session.role !== 'PROFESSIONAL') {
    return { error: 'No tienes permisos de profesional.' };
  }

  // Aseguramos que el ID sea String (según schema CUID)
  const professionalId = String(session.userId);

  try {
    // 3. Transacción: Borrar previos + Insertar nuevos
    await prisma.$transaction(async (tx) => {
      // A. Eliminar disponibilidad existente para evitar duplicados/conflictos
      await tx.availability.deleteMany({
        where: { professionalId }
      });

      // B. Insertar nuevos slots si el array no está vacío
      if (scheduleData && scheduleData.length > 0) {
        // Validamos datos mínimos antes de insertar
        const validSlots = scheduleData.map(slot => ({
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: slot.startTime,
          endTime: slot.endTime,
          professionalId: professionalId,
          isActive: true
        }));

        await tx.availability.createMany({
          data: validSlots
        });
      }
    });

    // 4. Revalidar caché
    revalidatePath('/dashboard-profesional'); 
    // También revalidamos la ruta específica de edición si existe
    revalidatePath('/dashboard-profesional/horarios');

    return { success: true, message: 'Disponibilidad actualizada correctamente.' };

  } catch (error) {
    console.error("Error en updateAvailability:", error);
    return { error: 'Error interno al guardar la disponibilidad.' };
  }
}