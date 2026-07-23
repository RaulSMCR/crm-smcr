"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ARTICLE_KINDS = new Set(["ARTICLE_NEW", "ARTICLE_FEATURED"]);
const PROFESSIONAL_KINDS = new Set(["PROFESSIONAL_NEW", "PROFESSIONAL_FEATURED"]);
const ALL_KINDS = new Set([...ARTICLE_KINDS, ...PROFESSIONAL_KINDS]);

function toStr(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toOrder(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(9999, Math.round(number)));
}

function readActive(formData) {
  const raw = toStr(formData.get("isActive"));
  return raw === "on" || raw === "true" || raw === "1";
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function revalidateCarouselPaths() {
  revalidatePath("/");
  revalidatePath("/panel/admin");
  revalidatePath("/panel/admin/marketing");
}

async function validateTarget(kind, postId, professionalId) {
  if (!ALL_KINDS.has(kind)) {
    return { error: "Seleccione una categoría valida para el carrusel." };
  }

  if (ARTICLE_KINDS.has(kind)) {
    if (!postId) return { error: "Seleccione un artículo publicado." };

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });

    if (!post) return { error: "Artículo no encontrado." };
    if (post.status !== "PUBLISHED") return { error: "Solo se pueden mostrar artículos publicados." };
    return { postId, professionalId: null };
  }

  if (!professionalId) return { error: "Seleccione un profesional aprobado." };

  const professional = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: {
      id: true,
      isApproved: true,
      user: { select: { isActive: true } },
    },
  });

  if (!professional) return { error: "Profesional no encontrado." };
  if (!professional.isApproved || !professional.user?.isActive) {
    return { error: "Solo se pueden mostrar profesionales activos y aprobados." };
  }

  return { postId: null, professionalId };
}

function readPayload(formData) {
  const kind = toStr(formData.get("kind")).trim();
  const label = toStr(formData.get("label")).trim() || null;
  const displayOrder = toOrder(formData.get("displayOrder"));
  const isActive = readActive(formData);
  const postId = toStr(formData.get("postId")).trim() || null;
  const professionalId = toStr(formData.get("professionalId")).trim() || null;

  return { kind, label, displayOrder, isActive, postId, professionalId };
}

export async function createHomeCarouselItem(formData) {
  try {
    await requireAdmin();
    const payload = readPayload(formData);
    const target = await validateTarget(payload.kind, payload.postId, payload.professionalId);
    if (target.error) return { error: target.error };

    await prisma.homeCarouselItem.create({
      data: {
        kind: payload.kind,
        label: payload.label,
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
        postId: target.postId,
        professionalId: target.professionalId,
      },
    });

    revalidateCarouselPaths();
    return { success: true };
  } catch (error) {
    console.error("Error creating home carousel item:", error);
    return { error: "No se pudo agregar la pieza al carrusel." };
  }
}

export async function updateHomeCarouselItem(itemId, formData) {
  try {
    await requireAdmin();
    const id = toStr(itemId).trim() || toStr(formData.get("id")).trim();
    if (!id) return { error: "ID de pieza requerido." };

    const payload = readPayload(formData);
    const target = await validateTarget(payload.kind, payload.postId, payload.professionalId);
    if (target.error) return { error: target.error };

    await prisma.homeCarouselItem.update({
      where: { id },
      data: {
        kind: payload.kind,
        label: payload.label,
        isActive: payload.isActive,
        displayOrder: payload.displayOrder,
        postId: target.postId,
        professionalId: target.professionalId,
      },
    });

    revalidateCarouselPaths();
    return { success: true };
  } catch (error) {
    console.error("Error updating home carousel item:", error);
    return { error: "No se pudo actualizar la pieza del carrusel." };
  }
}

export async function toggleHomeCarouselItem(itemId, isActive) {
  try {
    await requireAdmin();
    const id = toStr(itemId).trim();
    if (!id) return { error: "ID de pieza requerido." };

    await prisma.homeCarouselItem.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    revalidateCarouselPaths();
    return { success: true };
  } catch (error) {
    console.error("Error toggling home carousel item:", error);
    return { error: "No se pudo cambiar el estado de la pieza." };
  }
}

export async function deleteHomeCarouselItem(itemId) {
  try {
    await requireAdmin();
    const id = toStr(itemId).trim();
    if (!id) return { error: "ID de pieza requerido." };

    await prisma.homeCarouselItem.delete({ where: { id } });

    revalidateCarouselPaths();
    return { success: true };
  } catch (error) {
    console.error("Error deleting home carousel item:", error);
    return { error: "No se pudo eliminar la pieza del carrusel." };
  }
}
