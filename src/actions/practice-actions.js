// src/actions/practice-actions.js
// Lo que el profesional carga en su ficha y determina el precio de una cita:
// dónde atiende (PracticeLocation), en qué franjas cobra distinto
// (ProfessionalTimeBand) y cuánto cobra en cada combinación (ProfessionalRate).
//
// Regla de negocio: el profesional PROPONE precios, un admin los APRUEBA. Mientras
// una propuesta esté pendiente sigue rigiendo el último precio aprobado, así que
// nunca se le cobra al paciente un monto que nadie revisó.
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessionalProfileId } from "@/lib/auth-guards";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { findTimeBandOverlaps, parseHHMM } from "@/lib/rates";

const MODALITIES = ["OFFICE", "HOME", "VIRTUAL"];

function revalidatePractice() {
  revalidatePath("/panel/profesional/perfil");
  revalidatePath("/panel/profesional/horarios");
  revalidatePath("/panel/admin/personal");
  // Desde que el precio público sale de las tarifas, una tarifa que cambia
  // cambia lo que dice la ficha del profesional y el rango del servicio. Sin
  // esto el profesional ve su precio nuevo en el panel y el visitante sigue
  // viendo el viejo.
  revalidatePath("/servicios");
  revalidatePath("/servicios/[slug]", "page");
  revalidatePath("/profesionales/[slug]", "page");
}

/** Bloquea escrituras cuando un admin está mirando "como profesional". */
async function guardWrite() {
  const session = await getSession();
  if (isPreviewSession(session)) return { blocked: PREVIEW_BLOCKED_MESSAGE };
  return { professionalId: await requireProfessionalProfileId() };
}

// ── Lugares de atención ──────────────────────────────────────────────────────

export async function listPracticeLocations() {
  try {
    const professionalId = await requireProfessionalProfileId();
    const data = await prisma.practiceLocation.findMany({
      where: { professionalId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return { success: true, data };
  } catch (error) {
    console.error("listPracticeLocations error:", error);
    return { success: false, data: [], error: "No se pudieron cargar los lugares de atención." };
  }
}

export async function savePracticeLocation(input) {
  try {
    const guard = await guardWrite();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    const id = String(input?.id || "").trim() || null;
    const name = String(input?.name || "").trim();
    const modality = String(input?.modality || "").trim();

    if (!name) return { error: "El lugar necesita un nombre visible para el paciente." };
    if (!MODALITIES.includes(modality)) return { error: "Modalidad inválida." };

    // A domicilio la dirección la pone el paciente; virtual no tiene dirección.
    const address = modality === "OFFICE" ? String(input?.address || "").trim() || null : null;
    if (modality === "OFFICE" && !address) {
      return { error: "Una cita presencial necesita la dirección del consultorio." };
    }

    const data = {
      name,
      modality,
      address,
      instructions: String(input?.instructions || "").trim() || null,
      isActive: input?.isActive !== false,
      displayOrder: Number.isFinite(Number(input?.displayOrder)) ? Number(input.displayOrder) : 0,
    };

    if (id) {
      // El where incluye professionalId para que nadie edite el lugar de otro.
      const { count } = await prisma.practiceLocation.updateMany({
        where: { id, professionalId },
        data,
      });
      if (count === 0) return { error: "El lugar no existe o no le pertenece." };
    } else {
      await prisma.practiceLocation.create({ data: { ...data, professionalId } });
    }

    revalidatePractice();
    return { success: true };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya tiene un lugar con ese nombre." };
    console.error("savePracticeLocation error:", error);
    return { error: "No se pudo guardar el lugar de atención." };
  }
}

export async function deletePracticeLocation(locationId) {
  try {
    const guard = await guardWrite();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    const id = String(locationId || "").trim();
    if (!id) return { error: "Lugar inválido." };

    // Las citas ya agendadas conservan el nombre y la dirección copiados, así que
    // borrar el lugar no las deja sin datos (Appointment.locationId es SetNull).
    const { count } = await prisma.practiceLocation.deleteMany({ where: { id, professionalId } });
    if (count === 0) return { error: "El lugar no existe o no le pertenece." };

    revalidatePractice();
    return { success: true };
  } catch (error) {
    console.error("deletePracticeLocation error:", error);
    return { error: "No se pudo eliminar el lugar." };
  }
}

// ── Franjas horarias ─────────────────────────────────────────────────────────

export async function listTimeBands() {
  try {
    const professionalId = await requireProfessionalProfileId();
    const data = await prisma.professionalTimeBand.findMany({
      where: { professionalId },
      orderBy: [{ displayOrder: "asc" }, { startTime: "asc" }],
    });
    return { success: true, data };
  } catch (error) {
    console.error("listTimeBands error:", error);
    return { success: false, data: [], error: "No se pudieron cargar las franjas horarias." };
  }
}

/**
 * Reemplaza el juego completo de franjas. Se valida que no se pisen: si dos
 * franjas cubren las 12:30, el precio de esa cita dependería del orden de las
 * filas, que es justo lo que no queremos.
 */
export async function saveTimeBands(bands) {
  try {
    const guard = await guardWrite();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    if (!Array.isArray(bands)) return { error: "Formato inválido." };

    const normalized = [];
    const names = new Set();

    for (const band of bands) {
      const name = String(band?.name || "").trim();
      const startTime = String(band?.startTime || "").trim();
      const endTime = String(band?.endTime || "").trim();

      if (!name) return { error: "Cada franja necesita un nombre." };
      if (parseHHMM(startTime) === null || parseHHMM(endTime) === null) {
        return { error: `Horario inválido en "${name}". Use HH:mm (ej. 07:00).` };
      }
      if (startTime === endTime) {
        return { error: `La franja "${name}" empieza y termina a la misma hora.` };
      }

      const key = name.toLowerCase();
      if (names.has(key)) return { error: `Hay dos franjas llamadas "${name}".` };
      names.add(key);

      normalized.push({
        professionalId,
        name,
        startTime,
        endTime,
        displayOrder: normalized.length,
        id: String(band?.id || "").trim() || undefined,
      });
    }

    const overlaps = findTimeBandOverlaps(normalized);
    if (overlaps.length > 0) {
      const [a, b] = overlaps[0];
      return {
        error: `Las franjas "${a.name}" y "${b.name}" se solapan. Ajuste las horas para que no se pisen.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const keepIds = normalized.map((b) => b.id).filter(Boolean);

      // Al borrar una franja se borran en cascada sus tarifas: el precio de esa
      // franja deja de existir y las citas caen al catch-all.
      await tx.professionalTimeBand.deleteMany({
        where: { professionalId, ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}) },
      });

      for (const band of normalized) {
        const { id, ...values } = band;
        if (id) {
          await tx.professionalTimeBand.updateMany({ where: { id, professionalId }, data: values });
        } else {
          await tx.professionalTimeBand.create({ data: values });
        }
      }
    });

    revalidatePractice();
    return { success: true };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya tiene una franja con ese nombre." };
    console.error("saveTimeBands error:", error);
    return { error: "No se pudieron guardar las franjas horarias." };
  }
}

// ── Tarifas ──────────────────────────────────────────────────────────────────

export async function listMyRates() {
  try {
    const professionalId = await requireProfessionalProfileId();

    const [rates, assignments, locations, timeBands] = await Promise.all([
      prisma.professionalRate.findMany({
        where: { professionalId },
        include: {
          location: { select: { id: true, name: true, modality: true } },
          timeBand: { select: { id: true, name: true, startTime: true, endTime: true } },
          assignment: { select: { service: { select: { id: true, title: true } } } },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.serviceAssignment.findMany({
        where: { professionalId, status: "APPROVED" },
        select: { serviceId: true, service: { select: { id: true, title: true } } },
      }),
      prisma.practiceLocation.findMany({
        where: { professionalId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),
      prisma.professionalTimeBand.findMany({
        where: { professionalId },
        orderBy: [{ displayOrder: "asc" }, { startTime: "asc" }],
      }),
    ]);

    return { success: true, data: { rates, assignments, locations, timeBands } };
  } catch (error) {
    console.error("listMyRates error:", error);
    return { success: false, data: null, error: "No se pudieron cargar las tarifas." };
  }
}

/**
 * Propone el precio de una combinación (servicio, lugar, franja).
 * Deja la tarifa en PENDING: el precio aprobado anterior sigue vigente hasta que
 * un admin revise, de modo que proponer un cambio nunca interrumpe la agenda.
 */
export async function proposeRate(input) {
  try {
    const guard = await guardWrite();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    const serviceId = String(input?.serviceId || "").trim();
    const locationId = String(input?.locationId || "").trim() || null;
    const timeBandId = String(input?.timeBandId || "").trim() || null;
    const price = Number(input?.price);

    if (!serviceId) return { error: "Seleccione el tipo de consulta." };
    if (!Number.isFinite(price) || price <= 0) return { error: "El precio debe ser mayor que cero." };

    const assignment = await prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
      select: { status: true, service: { select: { price: true } } },
    });
    if (!assignment || assignment.status !== "APPROVED") {
      return { error: "Todavía no tiene aprobado ese tipo de consulta." };
    }

    // Lo que un admin revisa es la diferencia, no el trámite. Si el profesional
    // cobra exactamente el precio de catálogo del servicio —el que el admin ya
    // fijó— no hay nada que decidir: mandarlo a una cola de aprobación solo
    // retrasa que su ficha muestre precio. Apartarse del catálogo sí es una
    // decisión comercial, y esa espera revisión.
    const precioCatalogo = Number(assignment.service?.price);
    const coincideConCatalogo = Number.isFinite(precioCatalogo) && price === precioCatalogo;

    const revision = coincideConCatalogo
      ? { status: "APPROVED", approvedPrice: price, reviewedAt: new Date() }
      : { status: "PENDING", reviewedAt: null };

    // Lugar y franja deben ser propios: si no, un profesional podría colgar una
    // tarifa del lugar de otro.
    if (locationId) {
      const owned = await prisma.practiceLocation.count({ where: { id: locationId, professionalId } });
      if (owned === 0) return { error: "El lugar seleccionado no le pertenece." };
    }
    if (timeBandId) {
      const owned = await prisma.professionalTimeBand.count({ where: { id: timeBandId, professionalId } });
      if (owned === 0) return { error: "La franja seleccionada no le pertenece." };
    }

    const existing = await prisma.professionalRate.findFirst({
      where: { professionalId, serviceId, locationId, timeBandId },
    });

    if (existing) {
      if (Number(existing.approvedPrice) === price && existing.status === "APPROVED") {
        return { success: true, unchanged: true };
      }
      await prisma.professionalRate.update({
        where: { id: existing.id },
        data: {
          proposedPrice: price,
          adminReviewNote: null,
          requestedAt: new Date(),
          ...revision,
        },
      });
    } else {
      await prisma.professionalRate.create({
        data: { professionalId, serviceId, locationId, timeBandId, proposedPrice: price, ...revision },
      });
    }

    revalidatePractice();
    return { success: true, autoAprobada: coincideConCatalogo };
  } catch (error) {
    if (error?.code === "P2002") {
      return { error: "Ya existe una tarifa para esa combinación de lugar y franja." };
    }
    console.error("proposeRate error:", error);
    return { error: "No se pudo enviar la tarifa a revisión." };
  }
}

export async function deleteRate(rateId) {
  try {
    const guard = await guardWrite();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    const id = String(rateId || "").trim();
    if (!id) return { error: "Tarifa inválida." };

    const { count } = await prisma.professionalRate.deleteMany({ where: { id, professionalId } });
    if (count === 0) return { error: "La tarifa no existe o no le pertenece." };

    revalidatePractice();
    return { success: true };
  } catch (error) {
    console.error("deleteRate error:", error);
    return { error: "No se pudo eliminar la tarifa." };
  }
}
