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
 * UPDATE PERFIL (Profesional)
 * - User: name, phone, image
 * - ProfessionalProfile: specialty, licenseNumber, bio
 * - ServiceAssignment:
 *    - si selecciona un servicio NUEVO => create PENDING
 *    - si estaba REJECTED y lo re-selecciona => pasa a PENDING
 *    - si deselecciona => delete assignment
 *    - si está APPROVED y sigue seleccionado => se mantiene
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

    const requestedServiceIds = (formData.getAll("serviceIds") || [])
      .map((x) => toStr(x))
      .filter(Boolean);

    const proposedPricesEntries = (formData.getAll("proposedPrice") || [])
      .map((entry) => toStr(entry).split(":", 2))
      .filter(([serviceId, amount]) => serviceId && amount !== undefined)
      .map(([serviceId, amount]) => [serviceId, Number(amount)]);
    const proposedPricesByService = new Map(
      proposedPricesEntries.filter(([, amount]) => Number.isFinite(amount) && amount >= 0)
    );

    // Validar que existan y estén activos (evita ids basura)
    const validServices = await prisma.service.findMany({
      where: { id: { in: requestedServiceIds }, isActive: true },
      select: { id: true },
    });
    const selectedIds = new Set(validServices.map((s) => s.id));

    // Leer asignaciones actuales
    const currentAssignments = await prisma.serviceAssignment.findMany({
      where: { professionalId: professionalProfileId },
      select: { serviceId: true, status: true },
    });
    const currentMap = new Map(currentAssignments.map((a) => [a.serviceId, a.status]));

    const tx = [];

    // Update del perfil + user embebido
    tx.push(
      prisma.professionalProfile.update({
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
      })
    );

    // Deletes (deseleccionados)
    for (const a of currentAssignments) {
      if (!selectedIds.has(a.serviceId)) {
        tx.push(
          prisma.serviceAssignment.delete({
            where: {
              professionalId_serviceId: {
                professionalId: professionalProfileId,
                serviceId: a.serviceId,
              },
            },
          })
        );
      }
    }

    // Creates / Updates (seleccionados)
    for (const serviceId of selectedIds) {
      const existingStatus = currentMap.get(serviceId);

      if (!existingStatus) {
        // Nuevo => PENDING
        tx.push(
          prisma.serviceAssignment.create({
            data: {
              professionalId: professionalProfileId,
              serviceId,
              status: "PENDING",
              requestedAt: new Date(),
              reviewedAt: null,
              proposedSessionPrice: proposedPricesByService.get(serviceId) ?? null,
              approvedSessionPrice: null,
              adminReviewNote: null,
            },
          })
        );
        continue;
      }

      if (existingStatus === "REJECTED") {
        // Re-solicitud => vuelve a PENDING
        tx.push(
          prisma.serviceAssignment.update({
            where: {
              professionalId_serviceId: { professionalId: professionalProfileId, serviceId },
            },
            data: {
              status: "PENDING",
              requestedAt: new Date(),
              reviewedAt: null,
              proposedSessionPrice: proposedPricesByService.get(serviceId) ?? null,
              approvedSessionPrice: null,
              adminReviewNote: null,
            },
          })
        );
      }

      // APPROVED/PENDING se mantienen (no-op)
    }

    await prisma.$transaction(tx);

    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional");
    revalidatePath("/servicios");

    // Si tenés la página pública del profesional por slug:
    if (session?.slug) revalidatePath(`/profesionales/${session.slug}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    const msg = String(error?.message ?? "");
    if (msg.startsWith("No autorizado") || msg.includes("perfil profesional")) {
      return { success: false, error: msg };
    }
    return { success: false, error: "Error al actualizar perfil. Intenta nuevamente." };
  }
}
