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

function clampPercent(value, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.trunc(number)));
}

function clampScale(value, fallback = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(160, Math.max(100, Math.trunc(number)));
}

function normalizeCabys(value) {
  const raw = String(value || "").trim();
  return raw || null;
}

/** Lee los campos SEO editoriales del FormData (ver SeoFieldset). */
function readSeoFields(formData) {
  return {
    metaTitle: String(formData.get("metaTitle") || "").trim() || null,
    metaDescription: String(formData.get("metaDescription") || "").trim() || null,
    ogImage: String(formData.get("ogImage") || "").trim() || null,
    focusKeyword: String(formData.get("focusKeyword") || "").trim() || null,
    noindex: String(formData.get("noindex") || "") === "true",
  };
}

async function resolveServiceTax(formData) {
  const cabysCode = normalizeCabys(formData.get("cabysCode"));
  if (cabysCode && !/^\d{13}$/.test(cabysCode)) return { error: "El código CABYS debe tener exactamente 13 dígitos." };
  const taxId = String(formData.get("taxId") || "").trim() || null;
  if (!taxId) return { cabysCode, taxId: null };
  const tax = await prisma.tax.findFirst({ where: { id: taxId, isActive: true, scope: { in: ["SALES", "BOTH"] } }, select: { id: true } });
  if (!tax) return { error: "El impuesto seleccionado no está disponible para ventas." };
  return { cabysCode, taxId: tax.id };
}

export async function createService(formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const bannerImage = String(formData.get("bannerImage") || "").trim();
    const bannerFocusX = clampPercent(formData.get("bannerFocusX"), 50);
    const bannerFocusY = clampPercent(formData.get("bannerFocusY"), 50);
    const bannerScale = clampScale(formData.get("bannerScale"), 100);
    const bannerArtworkTitle = String(formData.get("bannerArtworkTitle") || "").trim();
    const bannerArtworkAuthor = String(formData.get("bannerArtworkAuthor") || "").trim();
    const bannerArtworkNote = String(formData.get("bannerArtworkNote") || "").trim();
    const price = toNum(formData.get("price"));
    const durationMin = toNum(formData.get("durationMin"));
    const displayOrder = toNum(formData.get("displayOrder"));
    const isActive = String(formData.get("isActive") || "true") === "true";
    const fiscal = await resolveServiceTax(formData);
    if (fiscal.error) return { error: fiscal.error };

    if (!title) return { error: "El título es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido." };
    if (!Number.isFinite(durationMin) || durationMin <= 0) return { error: "Duración inválida." };
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      return { error: "Orden de presentación inválido." };
    }

    const newService = await prisma.service.create({
      data: {
        title,
        description: description || null,
        bannerImage: bannerImage || null,
        bannerFocusX,
        bannerFocusY,
        bannerScale,
        bannerArtworkTitle: bannerArtworkTitle || null,
        bannerArtworkAuthor: bannerArtworkAuthor || null,
        bannerArtworkNote: bannerArtworkNote || null,
        price,
        durationMin: Math.trunc(durationMin),
        displayOrder: Math.trunc(displayOrder),
        isActive,
        cabysCode: fiscal.cabysCode,
        taxId: fiscal.taxId,
        ...readSeoFields(formData),
      },
    });

    revalidatePath("/panel/admin/servicios");
    revalidatePath("/servicios");
    revalidatePath("/");
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
    const bannerImage = String(formData.get("bannerImage") || "").trim();
    const bannerFocusX = clampPercent(formData.get("bannerFocusX"), 50);
    const bannerFocusY = clampPercent(formData.get("bannerFocusY"), 50);
    const bannerScale = clampScale(formData.get("bannerScale"), 100);
    const bannerArtworkTitle = String(formData.get("bannerArtworkTitle") || "").trim();
    const bannerArtworkAuthor = String(formData.get("bannerArtworkAuthor") || "").trim();
    const bannerArtworkNote = String(formData.get("bannerArtworkNote") || "").trim();
    const price = toNum(formData.get("price"));
    const durationMin = toNum(formData.get("durationMin"));
    const displayOrder = toNum(formData.get("displayOrder"));
    const isActive = String(formData.get("isActive") || "false") === "true";
    const fiscal = await resolveServiceTax(formData);
    if (fiscal.error) return { error: fiscal.error };

    if (!serviceId) return { error: "ID requerido." };
    if (!title) return { error: "El título es obligatorio." };
    if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido." };
    if (!Number.isFinite(durationMin) || durationMin <= 0) return { error: "Duración inválida." };
    if (!Number.isFinite(displayOrder) || displayOrder < 0) {
      return { error: "Orden de presentación inválido." };
    }

    await prisma.service.update({
      where: { id: String(serviceId) },
      data: {
        title,
        description: description || null,
        bannerImage: bannerImage || null,
        bannerFocusX,
        bannerFocusY,
        bannerScale,
        bannerArtworkTitle: bannerArtworkTitle || null,
        bannerArtworkAuthor: bannerArtworkAuthor || null,
        bannerArtworkNote: bannerArtworkNote || null,
        price,
        durationMin: Math.trunc(durationMin),
        displayOrder: Math.trunc(displayOrder),
        isActive,
        cabysCode: fiscal.cabysCode,
        taxId: fiscal.taxId,
        ...readSeoFields(formData),
      },
    });

    revalidatePath(`/panel/admin/servicios/${serviceId}`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/servicios");
    // La ruta pública es /servicios/[slug]; el id ya no es un path válido.
    revalidatePath('/servicios/[slug]', 'page');

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
    if (!sid) return { error: "ID de servicio inválido." };

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

    // Asignar en lote desde el panel del servicio también habilita a cobrar, así
    // que arrastra el mismo requisito que la aprobación individual: nadie queda
    // asignado sin una tarifa vigente. Acá no hay un precio negociado que usar,
    // así que se siembra el del catálogo y el profesional lo ajusta después desde
    // su panel (si difiere, vuelve a pasar por revisión).
    const servicio = await prisma.service.findUnique({
      where: { id: sid },
      select: { price: true },
    });
    if (!servicio) return { error: "No se encontró el servicio." };

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
            approvedSessionPrice: servicio.price,
          },
          update: {
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        })
      ),
    ]);

    for (const professionalId of validIds) {
      await garantizarTarifaVigente(professionalId, sid, Number(servicio.price));
    }

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath(`/panel/admin/servicios/${sid}/asignaciones`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/servicios");
    // La ruta pública es /servicios/[slug]; el id ya no es un path válido.
    revalidatePath('/servicios/[slug]', 'page');

    return { success: true };
  } catch (error) {
    console.error("syncServiceAssignments error:", error);
    return { error: "No se pudieron actualizar las asignaciones." };
  }
}

/**
 * Deja el servicio clasificado fiscalmente antes de habilitar a alguien a cobrarlo.
 *
 * Acepta los valores que el admin haya escrito en la misma pantalla de revisión;
 * si el servicio ya los tenía y no se mandan otros, los conserva. Devuelve error
 * cuando la clasificación sigue faltando, porque a partir de la aprobación toda
 * factura de ese servicio saldría incompleta.
 */
async function applyServiceFiscalData(serviceId, payload = {}) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { cabysCode: true, taxId: true },
  });
  if (!service) return { error: "No se encontró el servicio." };

  const rawCabys = payload?.cabysCode;
  const rawTaxId = payload?.taxId;

  const cabysCode =
    rawCabys === undefined || rawCabys === null || String(rawCabys).trim() === ""
      ? service.cabysCode
      : String(rawCabys).trim();
  const taxId =
    rawTaxId === undefined || rawTaxId === null || String(rawTaxId).trim() === ""
      ? service.taxId
      : String(rawTaxId).trim();

  if (!cabysCode || !taxId) {
    return {
      error:
        "Antes de aprobar hay que clasificar el servicio: indique el código CABYS y el IVA que le corresponde.",
    };
  }

  if (!/^\d{13}$/.test(cabysCode)) {
    return { error: "El código CABYS debe tener exactamente 13 dígitos." };
  }

  const tax = await prisma.tax.findUnique({ where: { id: taxId }, select: { id: true } });
  if (!tax) return { error: "El IVA seleccionado no existe." };

  if (cabysCode !== service.cabysCode || taxId !== service.taxId) {
    await prisma.service.update({ where: { id: serviceId }, data: { cabysCode, taxId } });
  }

  return { success: true };
}

/**
 * Deja al profesional con al menos una tarifa cobrable en ese servicio.
 *
 * El precio real vive en `ProfessionalRate` (servicio × lugar × franja) y se
 * resuelve por cascada; la tarifa que se siembra acá es el catch-all, el último
 * escalón: sin lugar ni franja, vale para cualquier combinación que el
 * profesional no haya afinado.
 *
 * **No pisa lo que ya existe.** Si el profesional ya tiene tarifas aprobadas
 * —quizá distintas por consultorio o por horario, que es justamente para lo que
 * está el modelo—, aprobar de nuevo la asignación no puede aplanarlas a un solo
 * monto. Solo actúa cuando no hay ninguna, que es el caso que dejaba fichas sin
 * precio.
 */
async function garantizarTarifaVigente(professionalId, serviceId, precio) {
  const monto = Number(precio);
  if (!Number.isFinite(monto) || monto <= 0) return { creada: false };

  const yaTiene = await prisma.professionalRate.count({
    where: { professionalId, serviceId, status: "APPROVED", approvedPrice: { not: null } },
  });
  if (yaTiene > 0) return { creada: false };

  // El catch-all puede existir en PENDING o REJECTED de un intento anterior: se
  // reutiliza esa fila en vez de crear otra, porque el índice único sobre
  // COALESCE(locationId,'')/COALESCE(timeBandId,'') solo admite un catch-all.
  const existente = await prisma.professionalRate.findFirst({
    where: { professionalId, serviceId, locationId: null, timeBandId: null },
    select: { id: true },
  });

  const datos = {
    status: "APPROVED",
    approvedPrice: monto,
    proposedPrice: monto,
    reviewedAt: new Date(),
  };

  if (existente) {
    await prisma.professionalRate.update({ where: { id: existente.id }, data: datos });
  } else {
    await prisma.professionalRate.create({
      data: { professionalId, serviceId, locationId: null, timeBandId: null, ...datos },
    });
  }

  return { creada: true };
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

    if (!current) return { error: "No se encontro la solicitud." };

    // Aprobar sin precio deja al profesional en el peor de los mundos: figura
    // habilitado en el panel, pero su ficha pública no lo muestra en el servicio
    // y la pantalla de agendar lo rechaza, sin que nada avise. Es lo que dejó a
    // tres de cuatro profesionales publicados y sin agenda. El precio es
    // requisito de la aprobación, no un campo opcional que se llena después.
    const precioFinal = decision === "APPROVED" ? (approvedPrice ?? Number(current.proposedSessionPrice)) : null;

    if (decision === "APPROVED" && (!Number.isFinite(precioFinal) || precioFinal <= 0)) {
      return {
        error:
          "Indique el precio de la sesión para aprobar: sin precio el profesional queda habilitado pero invisible en el servicio y no se le puede agendar.",
      };
    }

    // Clasificar fiscalmente el servicio es parte de aprobarlo: aprobar sin CABYS
    // ni IVA deja al profesional habilitado para cobrar y a cada factura suya
    // marcada como incompleta ante Hacienda. Se puede resolver en este mismo paso.
    if (decision === "APPROVED") {
      const fiscal = await applyServiceFiscalData(sid, payload);
      if (fiscal.error) return { error: fiscal.error };
    }

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: {
        status: decision,
        reviewedAt: new Date(),
        approvedSessionPrice: precioFinal,
        adminReviewNote: note || null,
      },
    });

    if (decision === "APPROVED") {
      await garantizarTarifaVigente(pid, sid, precioFinal);
    }

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath("/panel/admin/servicios");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/servicios");
    // La ruta pública es /servicios/[slug]; el id ya no es un path válido.
    revalidatePath('/servicios/[slug]', 'page');

    return { success: true };
  } catch (error) {
    console.error("reviewServiceAssignment error:", error);
    return { error: "No se pudo revisar la solicitud." };
  }
}

export async function updateAssignmentOnvoLink(professionalId, serviceId, onvoPaymentLinkId) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const pid = String(professionalId || "").trim();
    const sid = String(serviceId || "").trim();
    if (!pid || !sid) return { error: "Datos inválidos." };

    const linkId = String(onvoPaymentLinkId || "").trim() || null;

    await prisma.serviceAssignment.update({
      where: { professionalId_serviceId: { professionalId: pid, serviceId: sid } },
      data: { onvoPaymentLinkId: linkId },
    });

    revalidatePath(`/panel/admin/servicios/${sid}`);
    revalidatePath("/panel/admin/personal");

    return { success: true };
  } catch (error) {
    console.error("updateAssignmentOnvoLink error:", error);
    return { error: "No se pudo actualizar el enlace ONVO." };
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

    // Se recogen los fallos en vez de ignorarlos: si falta la clasificación
    // fiscal, aprobar en lote no puede terminar diciendo que todo salió bien.
    const failures = [];

    for (const item of assignmentUpdates) {
      const professionalId = String(item?.professionalId || "");
      if (!professionalId) continue;

      const decision = item?.decision === "REJECTED" ? "REJECTED" : "APPROVED";
      const res = await reviewServiceAssignment(sid, professionalId, {
        decision,
        approvedSessionPrice: item?.approvedSessionPrice,
        adminReviewNote: item?.adminReviewNote,
        cabysCode: item?.cabysCode,
        taxId: item?.taxId,
      });

      if (res?.error) failures.push(res.error);
    }

    if (failures.length > 0) return { error: failures[0] };

    return { success: true };
  } catch (error) {
    console.error("bulkReviewServiceAssignments error:", error);
    return { error: "No se pudo procesar la revisión masiva." };
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
