'use server'

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth'; // Tu librería jose
import { revalidatePath } from 'next/cache';

export async function createAppointment(professionalId, isoDateString) {
  // 1. Verificar Autenticación del Paciente
  const token = cookies().get('sessionToken')?.value;
  
  // Si no hay token, el usuario debe loguearse
  if (!token) {
    return { error: 'Debes iniciar sesión para reservar.' };
  }

  let session;
  try {
    session = await verifyToken(token);
  } catch (err) {
    return { error: 'Sesión inválida.' };
  }

  // 2. Validaciones de Datos
  if (!professionalId || !isoDateString) {
    return { error: 'Faltan datos de la reserva.' };
  }

  const appointmentDate = new Date(isoDateString);

  try {
    // 3. Crear la Cita en Base de Datos
    // Nota: Por ahora serviceId es null, luego lo integraremos
    const newAppointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        status: 'PENDING',
        userId: session.userId,           // ID del paciente logueado
        professionalId: professionalId,   // ID del profesional
      }
    });

    // 4. Revalidar para que el Dashboard del profesional se actualice
    revalidatePath('/dashboard-profesional');
    
    return { success: true, appointmentId: newAppointment.id };

  } catch (error) {
    console.error("Error creating appointment:", error);
    return { error: 'Error interno al guardar la cita.' };
  }
}