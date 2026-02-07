// src/actions/profile-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; 
import { revalidatePath } from "next/cache";

/**
 * ACTUALIZAR PERFIL COMPLETO
 * - Datos Personales (User): Nombre, Foto
 * - Datos Profesionales: Bio, Especialidad, Matrícula
 * - Servicios: Vinculación (Many-to-Many)
 */
export async function updateProfile(formData) {
  const session = await getSession();
  
  // Verificación de seguridad
  if (!session || session.role !== 'PROFESSIONAL') {
    return { error: "No autorizado" };
  }

  const professionalId = session.professionalId; // Usamos el ID del perfil linkeado en el token

  try {
    // 1. Recoger datos simples
    const name = formData.get('name');
    const specialty = formData.get('specialty');
    const licenseNumber = formData.get('licenseNumber');
    const bio = formData.get('bio');
    const imageUrl = formData.get('imageUrl'); // URL de la foto subida a Supabase
    
    // 2. Recoger los Servicios Seleccionados
    // formData.getAll('serviceIds') nos da un array ej: ['id1', 'id2']
    const serviceIds = formData.getAll('serviceIds');

    // 3. Ejecutar Update en Base de Datos
    await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        specialty,
        bio,
        licenseNumber,
        
        // A. Actualizamos el Usuario Padre (Nombre y Foto)
        user: {
          update: {
            name: name,
            ...(imageUrl && { image: imageUrl }), // Solo actualiza imagen si viene una nueva
          }
        },

        // B. Actualizamos la Relación con Servicios
        // 'set' reemplaza cualquier conexión anterior por la nueva lista que enviamos.
        // Si el array está vacío, el profesional se queda sin servicios (desvinculado).
        services: {
          set: serviceIds.map(id => ({ id })) 
        }
      }
    });

    // 4. Revalidar cachés para ver cambios inmediatos
    revalidatePath('/panel/profesional/perfil');
    revalidatePath('/panel/profesional');
    
    // Si existe slug en la sesión, revalidamos la página pública también
    if (session.slug) {
        revalidatePath(`/profesionales/${session.slug}`);
    }
    
    return { success: true, message: "Perfil guardado correctamente." };

  } catch (error) {
    console.error("Error updating profile:", error);
    return { error: "Error al actualizar perfil. Intenta nuevamente." };
  }
}