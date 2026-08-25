// src/actions/rate-review-actions.js
// Revisión administrativa de las tarifas propuestas por los profesionales.
//
// El profesional propone (ver src/actions/practice-actions.js) y acá un admin
// aprueba o rechaza. Aprobar es lo único que mueve `approvedPrice`: hasta ese
// momento sigue rigiendo el precio anterior, así que un cambio en revisión nunca
// altera lo que se le cobra a un paciente que ya agendó.
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function revalidateReview() {
  revalidatePath("/panel/admin/tarifas");
  revalidatePath("/panel/admin/personal");
  revalidatePath("/panel/profesional/perfil");
  // Aprobar una tarifa es lo que la vuelve pública: mueve el precio de la ficha
  // del profesional y el rango que muestra el servicio.
  revalidatePath("/servicios");
  revalidatePath("/servicios/[slug]", "page");
  revalidatePath("/profesionales/[slug]", "page");
}

const RATE_INCLUDE = {
  location: { select: { id: true, name: true, modality: true } },
  timeBand: { select: { id: true, name: true, startTime: true, endTime: true } },
  assignment: {
    select: {
      service: { select: { id: true, title: true } },
      professional: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
    },
  },
};

/**
 * Tarifas para el panel de revisión.
 * @param {"PENDING"|"APPROVED"|"REJECTED"|"ALL"} status
 */
export async function listRatesForReview(status = "PENDING") {
  try {
    const session = await getSession();
    requireAdmin(session);

    const where = status && status !== "ALL" ? { status } : {};
    const data = await prisma.professionalRate.findMany({
      where,
      include: RATE_INCLUDE,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    });

    return { success: true, data };
  } catch (error) {
    console.error("listRatesForReview error:", error);
    return { success: false, data: [], error: "No se pudieron cargar las tarifas." };
  }
}

export async function countPendingRates() {
  try {
    const session = await getSession();
    requireAdmin(session);
    return { success: true, count: await prisma.professionalRate.count({ where: { status: "PENDING" } }) };
  } catch (error) {
    console.error("countPendingRates error:", error);
    return { success: false, count: 0 };
  }
}

/**
 * Aprueba o rechaza una tarifa.
 *
 * El admin puede aprobar un monto distinto al propuesto (`overridePrice`), que es
 * como se negocia un precio sin obligar al profesional a reenviar la propuesta.
 */
export async function reviewRate(rateId, decision, { note = "", overridePrice = null } = {}) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const id = String(rateId || "").trim();
    if (!id) return { error: "Tarifa inválida." };
    if (!["APPROVED", "REJECTED"].includes(decision)) return { error: "Decisión inválida." };

    const rate = await prisma.professionalRate.findUnique({ where: { id } });
    if (!rate) return { error: "La tarifa no existe." };

    if (decision === "REJECTED") {
      await prisma.professionalRate.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminReviewNote: String(note || "").trim() || null,
          reviewedAt: new Date(),
          // `approvedPrice` queda intacto a propósito: si había un precio vigente
          // sigue rigiendo, y rechazar la propuesta no deja al profesional sin tarifa.
        },
      });
      revalidateReview();
      return { success: true };
    }

    const proposed = Number(rate.proposedPrice);
    const override = overridePrice === null || overridePrice === "" ? null : Number(overridePrice);
    const finalPrice = override !== null ? override : proposed;

    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      return { error: "No hay un precio válido que aprobar." };
    }

    await prisma.professionalRate.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedPrice: finalPrice,
        adminReviewNote: String(note || "").trim() || null,
        reviewedAt: new Date(),
      },
    });

    revalidateReview();
    return { success: true, approvedPrice: finalPrice };
  } catch (error) {
    console.error("reviewRate error:", error);
    return { error: "No se pudo revisar la tarifa." };
  }
}

/** Aprueba varias tarifas al precio propuesto, para despachar una cola larga. */
export async function bulkApproveRates(rateIds = []) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const ids = (Array.isArray(rateIds) ? rateIds : []).map((id) => String(id || "").trim()).filter(Boolean);
    if (ids.length === 0) return { error: "No se seleccionó ninguna tarifa." };

    const rates = await prisma.professionalRate.findMany({
      where: { id: { in: ids }, status: "PENDING" },
      select: { id: true, proposedPrice: true },
    });

    const usable = rates.filter((rate) => Number(rate.proposedPrice) > 0);
    if (usable.length === 0) return { error: "Ninguna de las tarifas tiene un precio propuesto válido." };

    await prisma.$transaction(
      usable.map((rate) =>
        prisma.professionalRate.update({
          where: { id: rate.id },
          data: {
            status: "APPROVED",
            approvedPrice: rate.proposedPrice,
            reviewedAt: new Date(),
          },
        })
      )
    );

    revalidateReview();
    return { success: true, approved: usable.length, skipped: ids.length - usable.length };
  } catch (error) {
    console.error("bulkApproveRates error:", error);
    return { error: "No se pudieron aprobar las tarifas." };
  }
}
