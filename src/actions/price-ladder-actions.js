// src/actions/price-ladder-actions.js
// Escaleras de precio: el profesional las propone y un admin las aprueba.
// Las reglas del precio viven en src/lib/price-ladder.js.
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { requireProfessionalProfileId } from "@/lib/auth-guards";
import { TARIFA_VIGENTE } from "@/lib/service-pricing";
import { escalonVigente, validarEscalones } from "@/lib/price-ladder";
import { revalidarPreciosPublicos } from "@/lib/revalidar-precios";

const TIERS = {
  orderBy: { position: "asc" },
  select: { id: true, position: true, price: true, capacity: true, seatsTaken: true },
};

/** La escalera actúa sobre la tarifa general: sin lugar ni franja. */
const TARIFA_GENERAL = {
  where: { locationId: null, timeBandId: null, ...TARIFA_VIGENTE },
  select: { approvedPrice: true },
  take: 1,
};

function revalidarPaneles() {
  revalidatePath("/panel/profesional/tarifas");
  revalidatePath("/panel/admin/tarifas");
}

/** Decimal de Prisma no cruza al cliente: los montos salen como número. */
function escaleraPlana(escalera) {
  const tiers = (escalera.tiers || []).map((tier) => ({ ...tier, price: Number(tier.price) }));
  const vigente = escalera.status === "APPROVED" ? escalonVigente({ tiers }) : null;
  return {
    id: escalera.id,
    serviceId: escalera.serviceId,
    status: escalera.status,
    adminReviewNote: escalera.adminReviewNote || null,
    requestedAt: escalera.requestedAt,
    reviewedAt: escalera.reviewedAt,
    tiers,
    escalonVigenteId: vigente?.id ?? null,
  };
}

function precioGeneralDe(assignment) {
  const tarifa = assignment?.rates?.[0];
  return tarifa ? Number(tarifa.approvedPrice) : null;
}

/** Bloquea escrituras cuando un admin está mirando "como profesional". */
async function guardProfesional() {
  const session = await getSession();
  if (isPreviewSession(session)) return { blocked: PREVIEW_BLOCKED_MESSAGE };
  return { professionalId: await requireProfessionalProfileId() };
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

// ── Profesional ──────────────────────────────────────────────────────────────

export async function listMyPriceLadders() {
  try {
    const professionalId = await requireProfessionalProfileId();

    const [escaleras, asignaciones] = await Promise.all([
      prisma.priceLadder.findMany({
        where: { professionalId, status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
        orderBy: { requestedAt: "desc" },
        take: 30,
        select: {
          id: true,
          serviceId: true,
          status: true,
          adminReviewNote: true,
          requestedAt: true,
          reviewedAt: true,
          tiers: TIERS,
        },
      }),
      prisma.serviceAssignment.findMany({
        where: { professionalId, status: "APPROVED" },
        select: { serviceId: true, service: { select: { title: true } }, rates: TARIFA_GENERAL },
      }),
    ]);

    return {
      success: true,
      data: {
        escaleras: escaleras.map(escaleraPlana),
        consultas: asignaciones.map((asignacion) => ({
          serviceId: asignacion.serviceId,
          title: asignacion.service?.title || "Consulta",
          precioGeneral: precioGeneralDe(asignacion),
        })),
      },
    };
  } catch (error) {
    console.error("listMyPriceLadders error:", error);
    return { success: false, data: { escaleras: [], consultas: [] }, error: "No se pudieron cargar las escaleras." };
  }
}

export async function proposePriceLadder({ serviceId, tiers } = {}) {
  try {
    const guard = await guardProfesional();
    if (guard.blocked) return { error: guard.blocked };
    const { professionalId } = guard;

    const sid = String(serviceId || "").trim();
    if (!sid) return { error: "Seleccione la consulta." };

    const validacion = validarEscalones(tiers);
    if (validacion.error) return { error: validacion.error };

    const asignacion = await prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId: sid } },
      select: { status: true, rates: TARIFA_GENERAL },
    });
    if (!asignacion || asignacion.status !== "APPROVED") {
      return { error: "Todavía no tiene aprobada esa consulta." };
    }
    // Cuando la escalera se completa rige la tarifa general: sin una aprobada no
    // habría precio al que volver.
    if (precioGeneralDe(asignacion) === null) {
      return { error: "Primero necesita un precio general aprobado para esa consulta (sin lugar ni franja)." };
    }

    await prisma.$transaction([
      // Una propuesta nueva reemplaza a la que estuviera esperando revisión.
      prisma.priceLadder.deleteMany({ where: { professionalId, serviceId: sid, status: "PENDING" } }),
      prisma.priceLadder.create({
        data: {
          professionalId,
          serviceId: sid,
          status: "PENDING",
          tiers: { create: validacion.escalones },
        },
      }),
    ]);

    revalidarPaneles();
    return { success: true };
  } catch (error) {
    console.error("proposePriceLadder error:", error);
    return { error: "No se pudo enviar la escalera a revisión." };
  }
}

export async function withdrawPriceLadder(ladderId) {
  try {
    const guard = await guardProfesional();
    if (guard.blocked) return { error: guard.blocked };

    const id = String(ladderId || "").trim();
    if (!id) return { error: "Escalera inválida." };

    const { count } = await prisma.priceLadder.deleteMany({
      where: { id, professionalId: guard.professionalId, status: "PENDING" },
    });
    if (count === 0) return { error: "La propuesta no existe o ya fue revisada." };

    revalidarPaneles();
    return { success: true };
  } catch (error) {
    console.error("withdrawPriceLadder error:", error);
    return { error: "No se pudo retirar la propuesta." };
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function listPriceLaddersForReview() {
  try {
    await requireAdmin();

    const escaleras = await prisma.priceLadder.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      // El enum se ordena por su declaración: PENDING primero.
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        serviceId: true,
        status: true,
        adminReviewNote: true,
        requestedAt: true,
        reviewedAt: true,
        tiers: TIERS,
        assignment: {
          select: {
            service: { select: { title: true } },
            professional: { select: { user: { select: { name: true } } } },
            rates: TARIFA_GENERAL,
          },
        },
      },
    });

    return {
      success: true,
      data: escaleras.map((escalera) => ({
        ...escaleraPlana(escalera),
        professionalName: escalera.assignment?.professional?.user?.name || "Profesional",
        serviceTitle: escalera.assignment?.service?.title || "Consulta",
        precioGeneral: precioGeneralDe(escalera.assignment),
      })),
    };
  } catch (error) {
    console.error("listPriceLaddersForReview error:", error);
    return { success: false, data: [], error: "No se pudieron cargar las escaleras." };
  }
}

/** Aprueba o rechaza una escalera propuesta. */
export async function reviewPriceLadder(ladderId, decision, { note = "" } = {}) {
  try {
    await requireAdmin();

    const id = String(ladderId || "").trim();
    if (!id) return { error: "Escalera inválida." };
    if (!["APPROVED", "REJECTED"].includes(decision)) return { error: "Decisión inválida." };

    const escalera = await prisma.priceLadder.findUnique({
      where: { id },
      select: { id: true, professionalId: true, serviceId: true, status: true },
    });
    if (!escalera) return { error: "La escalera no existe." };
    if (escalera.status !== "PENDING") return { error: "Esa escalera ya fue revisada." };

    const nota = String(note || "").trim() || null;
    const ahora = new Date();

    if (decision === "REJECTED") {
      await prisma.priceLadder.update({
        where: { id },
        data: { status: "REJECTED", adminReviewNote: nota, reviewedAt: ahora },
      });
      revalidarPaneles();
      return { success: true };
    }

    await prisma.$transaction([
      // Rige una sola escalera por consulta: aprobar una nueva cierra la
      // anterior. Quienes entraron en la anterior conservan su precio, porque la
      // inscripción no depende de la escalera.
      prisma.priceLadder.updateMany({
        where: { professionalId: escalera.professionalId, serviceId: escalera.serviceId, status: "APPROVED" },
        data: { status: "ENDED", endedAt: ahora },
      }),
      prisma.priceLadder.update({
        where: { id },
        data: { status: "APPROVED", adminReviewNote: nota, reviewedAt: ahora },
      }),
    ]);

    revalidarPaneles();
    revalidarPreciosPublicos();
    return { success: true };
  } catch (error) {
    console.error("reviewPriceLadder error:", error);
    return { error: "No se pudo revisar la escalera." };
  }
}

/** Termina una escalera vigente: desde ahí, los pacientes nuevos pagan la tarifa general. */
export async function endPriceLadder(ladderId, { note = "" } = {}) {
  try {
    await requireAdmin();

    const id = String(ladderId || "").trim();
    if (!id) return { error: "Escalera inválida." };

    const { count } = await prisma.priceLadder.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "ENDED", endedAt: new Date(), adminReviewNote: String(note || "").trim() || null },
    });
    if (count === 0) return { error: "La escalera no está vigente." };

    revalidarPaneles();
    revalidarPreciosPublicos();
    return { success: true };
  } catch (error) {
    console.error("endPriceLadder error:", error);
    return { error: "No se pudo terminar la escalera." };
  }
}
