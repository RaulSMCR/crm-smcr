"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { slugify } from "@/lib/carousel-spec";
import { revalidatePath } from "next/cache";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

async function getProfessionalId(session) {
  if (!session || session.role !== "PROFESSIONAL") return null;
  if (session.professionalProfileId) return String(session.professionalProfileId);
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: String(session.sub) },
    select: { id: true },
  });
  return profile?.id || null;
}

function revalidateLibrary(slug) {
  revalidatePath("/blog");
  revalidatePath("/panel/admin/blog/taxonomia");
  if (slug) revalidatePath(`/blog/${slug}`);
}

// ─── Vocabulario controlado (solo admin) ─────────────────────────────────────

async function createVocabTerm(model, name, extra = {}) {
  const clean = String(name || "").trim();
  if (clean.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  const slug = slugify(clean);
  if (!slug) return { error: "Nombre inválido." };

  const existing = await prisma[model].findFirst({
    where: { OR: [{ name: clean }, { slug }] },
    select: { id: true },
  });
  if (existing) return { error: "Ya existe un término con ese nombre." };

  await prisma[model].create({ data: { name: clean, slug, ...extra } });
  revalidateLibrary();
  return { success: true };
}

export async function createDiscipline(name) {
  requireAdmin(await getSession());
  return createVocabTerm("discipline", name);
}

export async function createTopic(name) {
  requireAdmin(await getSession());
  return createVocabTerm("topic", name);
}

export async function createSeries(name, description) {
  requireAdmin(await getSession());
  const clean = String(name || "").trim();
  if (clean.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  const slug = slugify(clean);
  if (!slug) return { error: "Nombre inválido." };
  const existing = await prisma.series.findFirst({
    where: { OR: [{ name: clean }, { slug }] },
    select: { id: true },
  });
  if (existing) return { error: "Ya existe una serie con ese nombre." };
  await prisma.series.create({
    data: { name: clean, slug, description: String(description || "").trim() || null },
  });
  revalidateLibrary();
  return { success: true };
}

async function updateVocabTerm(model, id, { name, isActive, order }) {
  const data = {};
  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
    data.slug = slugify(name.trim());
  }
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (Number.isFinite(Number(order))) data.order = Math.round(Number(order));
  if (!Object.keys(data).length) return { success: true };

  if (data.name) {
    const clash = await prisma[model].findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }], NOT: { id: String(id) } },
      select: { id: true },
    });
    if (clash) return { error: "Ya existe otro término con ese nombre." };
  }

  await prisma[model].update({ where: { id: String(id) }, data });
  revalidateLibrary();
  return { success: true };
}

export async function updateDiscipline(id, patch) {
  requireAdmin(await getSession());
  return updateVocabTerm("discipline", id, patch);
}

export async function updateTopic(id, patch) {
  requireAdmin(await getSession());
  return updateVocabTerm("topic", id, patch);
}

export async function updateSeries(id, { name, description, isActive }) {
  requireAdmin(await getSession());
  const data = {};
  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
    data.slug = slugify(name.trim());
  }
  if (typeof description === "string") data.description = description.trim() || null;
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (!Object.keys(data).length) return { success: true };
  if (data.name) {
    const clash = await prisma.series.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }], NOT: { id: String(id) } },
      select: { id: true },
    });
    if (clash) return { error: "Ya existe otra serie con ese nombre." };
  }
  await prisma.series.update({ where: { id: String(id) }, data });
  revalidateLibrary();
  return { success: true };
}

// Borrar un término no toca los artículos: las filas de unión caen por
// onDelete Cascade, y la serie se desvincula por SetNull. No se pierde ningún
// artículo, solo su clasificación bajo ese término.
export async function deleteDiscipline(id) {
  requireAdmin(await getSession());
  await prisma.discipline.delete({ where: { id: String(id) } });
  revalidateLibrary();
  return { success: true };
}

export async function deleteTopic(id) {
  requireAdmin(await getSession());
  await prisma.topic.delete({ where: { id: String(id) } });
  revalidateLibrary();
  return { success: true };
}

export async function deleteSeries(id) {
  requireAdmin(await getSession());
  await prisma.series.delete({ where: { id: String(id) } });
  revalidateLibrary();
  return { success: true };
}

// ─── Temas complementarios (admin) ───────────────────────────────────────────

export async function linkComplementaryTopics(fromId, toId) {
  requireAdmin(await getSession());
  const a = String(fromId || "");
  const b = String(toId || "");
  if (!a || !b || a === b) return { error: "Elegí dos temas distintos." };
  // Se guarda un solo sentido; la lectura consulta ambos. Idempotente.
  const existing = await prisma.topicComplement.findFirst({
    where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
    select: { id: true },
  });
  if (existing) return { success: true };
  await prisma.topicComplement.create({ data: { fromId: a, toId: b } });
  revalidateLibrary();
  return { success: true };
}

export async function unlinkComplementaryTopics(fromId, toId) {
  requireAdmin(await getSession());
  const a = String(fromId || "");
  const b = String(toId || "");
  await prisma.topicComplement.deleteMany({
    where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
  });
  revalidateLibrary();
  return { success: true };
}

// ─── Etiquetado de un artículo ───────────────────────────────────────────────

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || "")).filter(Boolean))];
}

async function setPostTags(tx, postId, { disciplineIds, topicIds }, { approve }) {
  const dIds = cleanIdList(disciplineIds);
  const tIds = cleanIdList(topicIds);

  if (approve) {
    // El admin es autoridad: el conjunto elegido queda tal cual, aprobado.
    await tx.postDiscipline.deleteMany({
      where: { postId, disciplineId: { notIn: dIds.length ? dIds : ["__none__"] } },
    });
    await tx.postTopic.deleteMany({
      where: { postId, topicId: { notIn: tIds.length ? tIds : ["__none__"] } },
    });
    for (const disciplineId of dIds) {
      await tx.postDiscipline.upsert({
        where: { postId_disciplineId: { postId, disciplineId } },
        create: { postId, disciplineId, status: "APPROVED" },
        update: { status: "APPROVED" },
      });
    }
    for (const topicId of tIds) {
      await tx.postTopic.upsert({
        where: { postId_topicId: { postId, topicId } },
        create: { postId, topicId, status: "APPROVED" },
        update: { status: "APPROVED" },
      });
    }
  } else {
    // El profesional propone: borra solo lo SUGERIDO que sacó; nunca pisa una
    // aprobación previa del admin. Lo nuevo entra como SUGGESTED.
    await tx.postDiscipline.deleteMany({
      where: { postId, status: "SUGGESTED", disciplineId: { notIn: dIds.length ? dIds : ["__none__"] } },
    });
    await tx.postTopic.deleteMany({
      where: { postId, status: "SUGGESTED", topicId: { notIn: tIds.length ? tIds : ["__none__"] } },
    });
    for (const disciplineId of dIds) {
      await tx.postDiscipline.upsert({
        where: { postId_disciplineId: { postId, disciplineId } },
        create: { postId, disciplineId, status: "SUGGESTED" },
        update: {}, // si ya existía (aprobada o sugerida), se respeta
      });
    }
    for (const topicId of tIds) {
      await tx.postTopic.upsert({
        where: { postId_topicId: { postId, topicId } },
        create: { postId, topicId, status: "SUGGESTED" },
        update: {},
      });
    }
  }
}

function normalizeSeries(seriesId, seriesOrder) {
  const id = String(seriesId || "") || null;
  const orderNum = Number(seriesOrder);
  const order = id && Number.isFinite(orderNum) ? Math.max(1, Math.round(orderNum)) : null;
  return { id, order };
}

// Profesional: propone la taxonomía de SU artículo.
export async function suggestPostTaxonomy(postId, payload = {}) {
  const session = await getSession();
  const professionalId = await getProfessionalId(session);
  if (!professionalId) return { error: "No autorizado." };

  const id = String(postId || "");
  const post = await prisma.post.findFirst({
    where: { id, authorId: professionalId },
    select: { id: true, slug: true, seriesId: true },
  });
  if (!post) return { error: "Artículo no encontrado." };

  const series = normalizeSeries(payload.seriesId, payload.seriesOrder);

  try {
    await prisma.$transaction(async (tx) => {
      await setPostTags(tx, id, payload, { approve: false });
      // Si cambia la serie propuesta, su aprobación se resetea.
      const seriesApproved = series.id && series.id === post.seriesId ? undefined : false;
      await tx.post.update({
        where: { id },
        data: {
          seriesId: series.id,
          seriesOrder: series.order,
          ...(seriesApproved === false ? { seriesApproved: false } : {}),
        },
      });
    });
  } catch (error) {
    console.error("Error sugiriendo taxonomía:", error);
    return { error: "No se pudo guardar la clasificación." };
  }

  revalidateLibrary(post.slug);
  return { success: true };
}

// Admin: aprueba/ajusta la taxonomía de cualquier artículo.
export async function approvePostTaxonomy(postId, payload = {}) {
  requireAdmin(await getSession());
  const id = String(postId || "");
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!post) return { error: "Artículo no encontrado." };

  const series = normalizeSeries(payload.seriesId, payload.seriesOrder);

  try {
    await prisma.$transaction(async (tx) => {
      await setPostTags(tx, id, payload, { approve: true });
      await tx.post.update({
        where: { id },
        data: {
          seriesId: series.id,
          seriesOrder: series.order,
          seriesApproved: Boolean(series.id),
        },
      });
    });
  } catch (error) {
    console.error("Error aprobando taxonomía:", error);
    return { error: "No se pudo guardar la clasificación." };
  }

  revalidateLibrary(post.slug);
  return { success: true };
}
