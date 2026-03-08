"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function toNum(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

export async function createService(formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = toNum(formData.get("price"));
    const durationMin = toNum(formData.get("durationMin"));
    const displayOrder = toNum(formData.get("displayOrder"));
    const isActive = String(formData.get("isActive") || "true") === "true";

    if (!title) return { error: "El titulo es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio invalido." };
    if (!Number.isFinite(durationMin) || durationMin <= 0) return { error: "Duracion invalida." };
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      return { error: "Orden de presentacion invalido." };
    }

    const newService = await prisma.service.create({
      data: {
        title,
        description: description || null,
        price,
        durationMin: Math.trunc(durationMin),
        displayOrder: Math.trunc(displayOrder),
        isActive,
      },
    });

    revalidatePath("/panel/admin/servicios");
    return { success: true, newId: newService.id };
  } catch (error) {
    console.error("createService error:", error);
    return { error: "Error creando servicio." };
  }
}

export async function updateServiceDetails(serviceId, formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = toNum(formData.get("price"));
    const durationMin = toNum(formData.get("durationMin"));
    const displayOrder = toNum(formData.get("displayOrder"));
    const isActive = String(formData.get("isActive") || "false") === "true";

    if (!serviceId) return { error: "ID requerido." };
    if (!title) return { error: "El titulo es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio invalido." };
    if (!Number.isFinite(durationMin) || durationMin <= 0) return { error: "Duracion invalida." };
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      return { error: "Orden de presentacion invalido." };
    }

    await prisma.service.update({
      where: { id: String(serviceId) },
      data: {
        title,
        description: description || null,
        price,
        durationMin: Math.trunc(durationMin),
        displayOrder: Math.trunc(displayOrder),
        isActive,
      },
    });

    revalidatePath(`/panel/admin/servicios/${serviceId}`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/servicios");
    revalidatePath(`/servicios/${serviceId}`);

    return { success: true };
  } catch (error) {
    console.error("updateServiceDetails error:", error);
    return { error: "Error actualizando servicio." };
  }
}

export async function syncServiceAssignments(serviceId, professionalIds = []) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId || "");
    if (!sid) return { error: "ID de servicio invalido." };

    const requestedIds = [...new Set((professionalIds || []).map((id) => String(id).trim()))].filter(
      Boolean
    );

    const approvedProfessionals = await prisma.professionalProfile.findMany({
      where: {
        id: { in: requestedIds },
        isApproved: true,
        user: { isActive: true },
      },
      select: { id: true },
    });

    const validIds = approvedProfessionals.map((profile) => profile.id);

    await prisma.$transaction([
      prisma.serviceAssignment.deleteMany({
        where: {
          serviceId: sid,
          ...(validIds.length > 0 ? { professionalId: { notIn: validIds } } : {}),
        },
      }),
      ...validIds.map((professionalId) =>
        prisma.serviceAssignment.upsert({
          where: { professionalId_serviceId: { professionalId, serviceId: sid } },
          create: {
            professionalId,
            serviceId: sid,
            status: "APPROVED",
            reviewedAt: new Date(),
            approvedSessionPrice: null,
          },
          update: {
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        })
      ),
    ]);

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios/${sid}/asignaciones`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/servicios");
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("syncServiceAssignments error:", error);
    return { error: "No se pudieron actualizar las asignaciones." };
  }
}

export async function reviewServiceAssignment(serviceId, professionalId, payload = {}) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId || "");
    const pid = String(professionalId || "");
    if (!sid || !pid) return { error: "Datos incompletos para revisar la solicitud." };

    const decision = payload?.decision === "REJECTED" ? "REJECTED" : "APPROVED";
    const approvedPriceRaw = payload?.approvedSessionPrice;
    const approvedPrice =
      approvedPriceRaw === "" || approvedPriceRaw === null || approvedPriceRaw === undefined
        ? null
        : Number(approvedPriceRaw);

    if (approvedPrice !== null && (!Number.isFinite(approvedPrice) || approvedPrice < 0)) {
      return { error: "Precio aprobado invalido." };
    }

    const note = String(payload?.adminReviewNote || "").trim();

    const current = await prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      select: { proposedSessionPrice: true },
    });

    if (!current) return { error: "No se encontro la solicitud." };

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: {
        status: decision,
        reviewedAt: new Date(),
        approvedSessionPrice:
          decision === "APPROVED" ? approvedPrice ?? current.proposedSessionPrice ?? null : null,
        adminReviewNote: note || null,
      },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/servicios");
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("reviewServiceAssignment error:", error);
    return { error: "No se pudo revisar la solicitud." };
  }
}

export async function bulkReviewServiceAssignments(serviceId, assignmentUpdates = []) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId || "");
    if (!sid) return { error: "Servicio invalido." };
    if (!Array.isArray(assignmentUpdates) || assignmentUpdates.length === 0) {
      return { error: "No hay solicitudes para procesar." };
    }

    for (const item of assignmentUpdates) {
      const professionalId = String(item?.professionalId || "");
      if (!professionalId) continue;

      const decision = item?.decision === "REJECTED" ? "REJECTED" : "APPROVED";
      await reviewServiceAssignment(sid, professionalId, {
        decision,
        approvedSessionPrice: item?.approvedSessionPrice,
        adminReviewNote: item?.adminReviewNote,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("bulkReviewServiceAssignments error:", error);
    return { error: "No se pudo procesar la revision masiva." };
  }
}

export async function bulkUpdateServiceOrder(items = []) {
  try {
    const session = await getSession();
    requireAdmin(session);

    if (!Array.isArray(items) || items.length === 0) {
      return { error: "No hay cambios para guardar." };
    }

    const normalized = items
      .map((item) => ({
        id: String(item?.id || "").trim(),
        displayOrder: Number(item?.displayOrder),
      }))
      .filter((item) => item.id);

    if (normalized.length === 0) {
      return { error: "No hay servicios validos para actualizar." };
    }

    for (const item of normalized) {
      if (!Number.isFinite(item.displayOrder) || item.displayOrder < 0) {
        return { error: "Todos los ordenes deben ser numeros iguales o mayores a 0." };
      }
    }

    await prisma.$transaction(
      normalized.map((item) =>
        prisma.service.update({
          where: { id: item.id },
          data: { displayOrder: Math.trunc(item.displayOrder) },
        })
      )
    );

    revalidatePath("/panel/admin/servicios");
    revalidatePath("/panel/admin/servicios/organizar");
    revalidatePath("/servicios");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("bulkUpdateServiceOrder error:", error);
    return { error: "No se pudo actualizar el orden de servicios." };
  }
}
