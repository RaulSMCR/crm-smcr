//src/actions/service-actions.js
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. CREAR SERVICIO (Básico)
export async function createService(formData) {
  const title = formData.get('title');
  const price = formData.get('price');
  
  if (!title || !price) return { error: "Datos incompletos" };

  try {
    const newService = await prisma.service.create({
      data: {
        title,
        price: parseFloat(price),
        durationMin: 60, // Valor por defecto
        isActive: true,
        description: "Servicio creado desde panel admin."
      }
    });
    // Redirigimos al detalle para configurarlo a fondo
    return { success: true, newId: newService.id };
  } catch (error) {
    return { error: "Error creando servicio." };
  }
}

// 2. ACTUALIZAR DETALLES (Nombre, Precio Base, Descripción)
export async function updateServiceDetails(serviceId, formData) {
    const title = formData.get('title');
    const description = formData.get('description');
    const price = formData.get('price');
    const durationMin = formData.get('durationMin');

    try {
        await prisma.service.update({
            where: { id: serviceId },
            data: {
                title,
                description,
                price: parseFloat(price),
                durationMin: parseInt(durationMin)
            }
        });
        revalidatePath(`/panel/admin/servicios/${serviceId}`);
        return { success: true };
    } catch (error) {
        return { error: "Error actualizando servicio." };
    }
}

// 3. ASIGNAR PROFESIONAL AL SERVICIO
export async function addProfessionalToService(serviceId, professionalId) {
    try {
        await prisma.service.update({
            where: { id: serviceId },
            data: {
                professionals: {
                    connect: { id: professionalId }
                }
            }
        });
        revalidatePath(`/panel/admin/servicios/${serviceId}`);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: "No se pudo asignar el profesional." };
    }
}

// 4. REMOVER PROFESIONAL DEL SERVICIO
export async function removeProfessionalFromService(serviceId, professionalId) {
    try {
        await prisma.service.update({
            where: { id: serviceId },
            data: {
                professionals: {
                    disconnect: { id: professionalId }
                }
            }
        });
        revalidatePath(`/panel/admin/servicios/${serviceId}`);
        return { success: true };
    } catch (error) {
        return { error: "No se pudo remover el profesional." };
    }
}

// 5. ELIMINAR SERVICIO COMPLETO
export async function deleteService(serviceId) {
    try {
        await prisma.service.delete({ where: { id: serviceId }});
        revalidatePath('/panel/admin/servicios');
        return { success: true };
    } catch (e) {
        return { error: "No se puede borrar si tiene citas asociadas. Desactívalo mejor." };
    }
}