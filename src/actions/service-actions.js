// src/actions/service-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * 1) CREAR SERVICIO
 */
export async function createService(formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const title = String(formData.get("title") || "").trim();
    const price = toNum(formData.get("price"));

    if (!title) return { error: "El título es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido." };

    const newService = await prisma.service.create({
      data: {
        title,
        price,
        durationMin: 60,
        isActive: true,
        description: "Servicio creado desde panel admin.",
      },
    });

    revalidatePath("/panel/admin/servicios");
    return { success: true, newId: newService.id };
  } catch (error) {
    console.error("createService error:", error);
    return { error: "Error creando servicio." };
  }
}

/**
 * 2) ACTUALIZAR DETALLES DE SERVICIO
 */
export async function updateServiceDetails(serviceId, formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = toNum(formData.get("price"));
    const durationMin = toNum(formData.get("durationMin"));
    const isActive = String(formData.get("isActive") || "false") === "true";

    if (!serviceId) return { error: "ID requerido." };
    if (!title) return { error: "El título es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido." };
    if (!Number.isFinite(durationMin) || durationMin <= 0) return { error: "Duración inválida." };

    await prisma.service.update({
      where: { id: String(serviceId) },
      data: {
        title,
        description: description || null,
        price,
        durationMin: Math.trunc(durationMin),
        isActive,
      },
    });

    revalidatePath(`/panel/admin/servicios/${serviceId}`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/servicios`);
    revalidatePath(`/servicios/${serviceId}`);

    return { success: true };
  } catch (error) {
    console.error("updateServiceDetails error:", error);
    return { error: "Error actualizando servicio." };
  }
}

/**
 * 2.1) ACTUALIZAR ASIGNACIONES DE UN SERVICIO (LISTA EXACTA)
 */
export async function syncServiceAssignments(serviceId, professionalIds = []) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId || "");
    if (!sid) return { error: "ID de servicio inválido." };

    const requestedIds = [...new Set((professionalIds || []).map((id) => String(id).trim()))].filter(
      Boolean,
    );

    const approvedProfessionals = await prisma.professionalProfile.findMany({
      where: {
        id: { in: requestedIds },
        isApproved: true,
        user: { isActive: true },
      },
      select: { id: true },
    });

    const validIds = approvedProfessionals.map((p) => p.id);

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
          },
          update: {
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        }),
      ),
    ]);

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios/${sid}/asignaciones`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/panel/admin/personal`);
    revalidatePath(`/servicios`);
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("syncServiceAssignments error:", error);
    return { error: "No se pudieron actualizar las asignaciones." };
  }
}

/**
 * 3) ADMIN: AGREGAR PROFESIONAL AL SERVICIO (FORZAR APPROVED)
 * - Crea o actualiza la asignación a APPROVED.
 */
export async function addProfessionalToService(serviceId, professionalId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId);
    const pid = String(professionalId);

    await prisma.serviceAssignment.upsert({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      create: {
        professionalId: pid,
        serviceId: sid,
        status: "APPROVED",
        reviewedAt: new Date(),
      },
      update: {
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/servicios`);
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("addProfessionalToService error:", error);
    return { error: "No se pudo asignar el profesional." };
  }
}

/**
 * 4) ADMIN: REMOVER PROFESIONAL DEL SERVICIO
 * - Borra la asignación (sea PENDING/APPROVED/REJECTED)
 */
export async function removeProfessionalFromService(serviceId, professionalId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId);
    const pid = String(professionalId);

    await prisma.serviceAssignment.delete({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/servicios`);
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("removeProfessionalFromService error:", error);
    return { error: "No se pudo remover el profesional." };
  }
}

/**
 * 5) ADMIN: APROBAR REQUEST (PENDING -> APPROVED)
 */
export async function approveServiceAssignment(serviceId, professionalId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId);
    const pid = String(professionalId);

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        approvedSessionPrice: { set: null },
      },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/servicios`);
    revalidatePath(`/servicios/${sid}`);

    return { success: true };
  } catch (error) {
    console.error("approveServiceAssignment error:", error);
    return { error: "No se pudo aprobar la solicitud." };
  }
}

/**
 * 6) ADMIN: RECHAZAR REQUEST (PENDING -> REJECTED)
 */
export async function rejectServiceAssignment(serviceId, professionalId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const sid = String(serviceId);
    const pid = String(professionalId);

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios`);

    return { success: true };
  } catch (error) {
    console.error("rejectServiceAssignment error:", error);
    return { error: "No se pudo rechazar la solicitud." };
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
      return { error: "Precio aprobado inválido." };
    }

    const note = String(payload?.adminReviewNote || "").trim();

    const current = await prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      select: { proposedSessionPrice: true },
    });

    if (!current) return { error: "No se encontró la solicitud." };

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: {
        status: decision,
        reviewedAt: new Date(),
        approvedSessionPrice:
          decision === "APPROVED"
            ? approvedPrice ?? current.proposedSessionPrice ?? null
            : null,
        adminReviewNote: note || null,
      },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios`);
    revalidatePath(`/panel/admin/personal`);
    revalidatePath(`/panel/profesional/perfil`);
    revalidatePath(`/servicios`);
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
    if (!sid) return { error: "Servicio inválido." };
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
    return { error: "No se pudo procesar la revisión masiva." };
  }
}

/**
 * 7) ELIMINAR SERVICIO
 */
export async function deleteService(serviceId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    await prisma.service.delete({ where: { id: String(serviceId) } });

    revalidatePath("/panel/admin/servicios");
    revalidatePath("/servicios");

    return { success: true };
  } catch (e) {
    console.error("deleteService error:", e);
    return { error: "No se puede borrar si tiene citas asociadas. Desactívalo mejor." };
  }
}
