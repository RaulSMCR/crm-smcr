//src/actions/profile-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; // <--- 1. CORRECCIÓN: Import directo
import { revalidatePath } from "next/cache";

/**
 * 1. ACTUALIZAR PERFIL (Bio, Especialidad, Nombre)
 */
export async function updateProfile(formData) {
  const session = await getSession();
  
  // Verificación estricta de rol
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };

  // 2. CORRECCIÓN: Usar el ID plano del nuevo token
  const professionalId = session.professionalId;

  try {
    const name = formData.get('name');
    const specialty = formData.get('specialty');
    const bio = formData.get('bio');
    // Si manejamos avatar (URL):
    const avatarUrl = formData.get('avatarUrl'); 

    // 3. CORRECCIÓN: Actualización Cruzada
    // Actualizamos ProfessionalProfile, pero A TRAVÉS de él, actualizamos también al User (Nombre/Foto)
    await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        specialty,
        bio,
        // Prisma permite actualizar la relación padre (User) aquí mismo
        user: {
          update: {
            name: name,
            ...(avatarUrl && { image: avatarUrl }), // Solo actualiza si hay dato
          }
        }
      }
    });

    revalidatePath('/panel/profesional/perfil');
    // revalidatePath(`/profesional/${session.slug}`); // Si tienes vista pública
    
    return { success: true, message: "Perfil actualizado correctamente." };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { error: "Error al actualizar perfil." };
  }
}

/**
 * 2. GESTIONAR SERVICIOS (Crear / Editar / Borrar)
 */
export async function manageService(action, data) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };
  
  const professionalId = session.professionalId;

  try {
    if (action === 'CREATE') {
      await prisma.service.create({
        data: {
          title: data.title,
          description: data.description,
          price: parseFloat(data.price),
          durationMin: parseInt(data.durationMin),
          // Conectamos al ProfessionalProfile
          professionals: {
            connect: { id: professionalId }
          }
        }
      });
    } 
    else if (action === 'UPDATE') {
      // Verificamos propiedad
      const service = await prisma.service.findFirst({
        where: { id: data.id, professionals: { some: { id: professionalId } } }
      });
      
      if (!service) return { error: "Servicio no encontrado o sin permiso." };

      await prisma.service.update({
        where: { id: data.id },
        data: {
          title: data.title,
          description: data.description,
          price: parseFloat(data.price),
          durationMin: parseInt(data.durationMin),
        }
      });
    }
    else if (action === 'DELETE') {
      // Verificamos propiedad antes de borrar
      const service = await prisma.service.findFirst({
        where: { id: data.id, professionals: { some: { id: professionalId } } }
      });

      if (!service) return { error: "Servicio no encontrado." };

      await prisma.service.delete({
        where: { id: data.id }
      });
    }

    revalidatePath('/panel/profesional/perfil');
    return { success: true };

  } catch (error) {
    console.error(error);
    return { error: "Error al gestionar servicio." };
  }
}