// src/actions/profile-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireProfessionalContext } from "@/lib/auth-guards";

function toStr(x) {
  if (x === undefined || x === null) return "";
  return String(x);
}

function normalizePhone(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

function isPhoneValid(v) {
  const s = normalizePhone(v);
  if (!s) return false;
  if (!/^[+0-9()\-\s]+$/.test(s)) return false;
  const digits = (s.match(/\d/g) || []).length;
  return digits >= 8;
}

/**
 * ACTUALIZAR PERFIL COMPLETO
 * - User: name, image, phone
 * - ProfessionalProfile: specialty, licenseNumber, bio
 * - ServiceAssignment:
 *    - nuevos -> PENDING (requiere aprobación admin)
 *    - removidos -> se eliminan (remoción directa)
 */
export async function updateProfile(formData) {
  try {
    const { session, professionalProfileId } = await requireProfessionalContext();

    const name = toStr(formData.get("name")).trim();
    const phoneRaw = formData.get("phone");
    const phone = normalizePhone(phoneRaw);

    const specialty = toStr(formData.get("specialty")).trim();
    const licenseNumber = toStr(formData.get("licenseNumber")).trim() || null;
    const bio = toStr(formData.get("bio")).trim() || null;
    const imageUrl = toStr(formData.get("imageUrl")).trim() || null;

    if (!name) return { success: false, error: "El nombre es obligatorio." };
    if (!specialty) return { success: false, error: "La especialidad es obligatoria." };

    if (phoneRaw !== null && phoneRaw !== undefined) {
      if (!phone) return { success: false, error: "El teléfono es obligatorio." };
      if (!isPhoneValid(phone)) return { success: false, error: "Teléfono inválido." };
    }

    // IDs elegidos desde UI
    const rawSelected = (formData.getAll("serviceIds") || [])
      .map((x) => toStr(x))
      .filter(Boolean);

    const selectedUnique = [...new Set(rawSelected)];

    // seguridad: sólo permitir servicios activos existentes
    const activeServices = await prisma.service.findMany({
      where: { id: { in: selectedUnique }, isActive: true },
      select: { id: true },
    });
    const allowedSelected = new Set(activeServices.map((s) => s.id));
    const selectedServiceIds = selectedUnique.filter((id) => allowedSelected.has(id));

    const existing = await prisma.serviceAssignment.findMany({
      where: { professionalId: professionalProfileId },
      select: { serviceId: true, status: true },
    });

    const existingByService = new Map(existing.map((r) => [r.serviceId, r.status]));
    const existingIds = new Set(existing.map((r) => r.serviceId));

    const toRemove = [...existingIds].filter((id) => !selectedServiceIds.includes(id));

    let pendingRequested = 0;

    await prisma.$transaction(async (tx) => {
      await tx.professionalProfile.update({
        where: { id: professionalProfileId },
        data: {
          specialty,
          licenseNumber,
          bio,
          user: {
            update: {
              name,
              ...(phoneRaw !== null && phoneRaw !== undefined ? { phone } : {}),
              ...(imageUrl ? { image: imageUrl } : {}),
            },
          },
        },
      });

      // altas: crear PENDING o reintentar si estaba REJECTED
      for (const serviceId of selectedServiceIds) {
        const status = existingByService.get(serviceId);

        if (!status) {
          await tx.serviceAssignment.create({
            data: {
              professionalId: professionalProfileId,
              serviceId,
              status: "PENDING",
            },
          });
          pendingRequested += 1;
        } else if (status === "REJECTED") {
          await tx.serviceAssignment.update({
            where: {
              professionalId_serviceId: {
                professionalId: professionalProfileId,
                serviceId,
              },
            },
            data: {
              status: "PENDING",
              reviewedAt: null,
            },
          });
          pendingRequested += 1;
        }
        // si PENDING o APPROVED -> no tocar
      }

      // bajas: eliminar relación (directo)
      if (toRemove.length > 0) {
        await tx.serviceAssignment.deleteMany({
          where: {
            professionalId: professionalProfileId,
            serviceId: { in: toRemove },
          },
        });
      }
    });

    // revalidaciones
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional");
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/servicios");

    if (session?.slug) revalidatePath(`/profesionales/${session.slug}`);

    return { success: true, pendingRequested };
  } catch (error) {
    console.error("Error updating profile:", error);
    const msg = String(error?.message ?? "");
    if (msg.startsWith("No autorizado") || msg.includes("perfil profesional")) {
      return { success: false, error: msg };
    }
    return { success: false, error: "Error al actualizar perfil. Intenta nuevamente." };
  }
}
