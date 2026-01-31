//src/actions/profile-actions.js

'use server'

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";

/**
 * 1. ACTUALIZAR PERFIL (Bio, Especialidad, Nombre)
 */
export async function updateProfile(formData) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };

  const professionalId = session.profile.id;

  try {
    const name = formData.get('name');
    const specialty = formData.get('specialty');
    const bio = formData.get('bio');
    // Nota: El avatar requiere subida de archivos (Cloudinary/Supabase). 
    // Por ahora lo manejamos si envían una URL directa.
    const avatarUrl = formData.get('avatarUrl'); 

    await prisma.professional.update({
      where: { id: professionalId },
      data: {
        name,
        specialty,
        bio,
        ...(avatarUrl && { avatarUrl }), // Solo actualiza si hay dato
      }
    });

    revalidatePath('/panel/profesional/perfil');
    revalidatePath(`/agendar/${professionalId}`); // Actualizar vista pública
    
    return { success: true, message: "Perfil actualizado." };
  } catch (error) {
    return { error: "Error al actualizar perfil." };
  }
}

/**
 * 2. GESTIONAR SERVICIOS (Crear / Editar / Borrar)
 */
export async function manageService(action, data) {
  const session = await getSession();
  if (!session || session.role !== 'PROFESSIONAL') return { error: "No autorizado" };
  
  const professionalId = session.profile.id;

  try {
    if (action === 'CREATE') {
      await prisma.service.create({
        data: {
          title: data.title,
          description: data.description,
          price: parseFloat(data.price),
          durationMin: parseInt(data.durationMin),
          // Conectamos al profesional usando la relación many-to-many implícita o explícita
          professionals: {
            connect: { id: professionalId }
          }
        }
      });
    } 
    else if (action === 'UPDATE') {
      // Verificamos que el servicio pertenezca al profesional (seguridad)
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
      // Para borrar, primero desconectamos. 
      // Si el servicio es compartido, solo se desconecta. Si es único, se podría borrar.
      // Por simplicidad, aquí lo borramos (Asumiendo que cada pro crea sus servicios).
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