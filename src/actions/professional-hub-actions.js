"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { normalizeTopicSlug, validateTopicSlug } from "@/lib/topic";

const STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const MODULE_TYPES = new Set(["TOPIC", "TREATMENT", "CUSTOM"]);
const FUNCTIONS = new Set(["agenda", "whatsapp", "topics", "treatment", "writing", "tools", "help"]);

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") throw new Error("No autorizado: se requiere rol ADMIN.");
}

async function admin() {
  const session = await getSession();
  requireAdmin(session);
}

function clean(value, max = 50000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function functions(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((item) => String(item)).filter((item) => FUNCTIONS.has(item)))];
}

function hubData(payload = {}) {
  const name = clean(payload.name, 160);
  const slug = normalizeTopicSlug(payload.slug || name);
  const slugError = validateTopicSlug(slug);
  const status = String(payload.status || "DRAFT");
  if (name.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  if (slugError) return { error: slugError };
  if (!STATUSES.has(status)) return { error: "Estado de hub inválido." };

  return {
    data: {
      name,
      slug,
      title: clean(payload.title, 200) || name,
      description: clean(payload.description, 30000) || null,
      profileSlug: clean(payload.profileSlug, 120),
      whatsapp: clean(payload.whatsapp, 40) || null,
      modality: clean(payload.modality, 80) || null,
      durationMin: integer(payload.durationMin, 0) || null,
      featuredSeriesSlug: clean(payload.featuredSeriesSlug, 160) || null,
      heroVideoUrl: clean(payload.heroVideoUrl, 2000) || null,
      heroPosterUrl: clean(payload.heroPosterUrl, 2000) || null,
      logoUrl: clean(payload.logoUrl, 2000) || null,
      enabledFunctions: functions(payload.enabledFunctions),
      status,
    },
  };
}

function moduleData(payload = {}) {
  const title = clean(payload.title, 240);
  const slug = normalizeTopicSlug(payload.slug || title);
  const type = String(payload.type || "TOPIC");
  if (title.length < 2) return { error: "El módulo necesita un título." };
  if (!slug) return { error: "El slug del módulo es obligatorio." };
  if (!MODULE_TYPES.has(type)) return { error: "Tipo de módulo inválido." };

  return {
    data: {
      slug,
      type,
      title,
      summary: clean(payload.summary, 5000) || null,
      body: clean(payload.body, 50000) || null,
      metadata: {
        titulo_seo: clean(payload.titulo_seo, 240),
        meta: clean(payload.meta, 1000),
        fecha: clean(payload.fecha, 40),
        actualizado: clean(payload.actualizado, 40),
      },
      position: integer(payload.position),
      isVisible: payload.isVisible !== false,
      isPublished: payload.isPublished === true,
    },
  };
}

function revalidateHub(slug) {
  revalidatePath("/panel/admin/hubs");
  revalidatePath("/panel/admin/hubs/profesional/nuevo");
  revalidatePath("/panel/admin/hubs/profesional/[id]", "page");
  revalidatePath("/raul-olmedo-evans");
  revalidatePath("/raul-olmedo-evans/[tema]", "page");
  revalidatePath("/raul-olmedo-evans/tratamiento-breve-15-sesiones");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/${slug}`);
}

export async function createProfessionalHub(payload = {}) {
  await admin();
  const parsed = hubData(payload);
  if (parsed.error) return parsed;
  const profile = parsed.data.profileSlug
    ? await prisma.professionalProfile.findUnique({ where: { slug: parsed.data.profileSlug }, select: { id: true } })
    : null;
  if (parsed.data.profileSlug && !profile) return { error: "No se encontró el perfil profesional seleccionado." };

  try {
    const hub = await prisma.professionalHub.create({
      data: { ...parsed.data, professionalProfileId: profile?.id || null },
      select: { id: true, slug: true },
    });
    revalidateHub(hub.slug);
    return { success: true, id: hub.id };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya existe un hub con ese slug o perfil." };
    console.error("createProfessionalHub error:", error);
    return { error: "No se pudo crear el hub profesional." };
  }
}

export async function updateProfessionalHub(id, payload = {}) {
  await admin();
  const hubId = String(id || "");
  const parsed = hubData(payload);
  if (!hubId) return { error: "Hub inválido." };
  if (parsed.error) return parsed;
  const profile = parsed.data.profileSlug
    ? await prisma.professionalProfile.findUnique({ where: { slug: parsed.data.profileSlug }, select: { id: true } })
    : null;
  if (parsed.data.profileSlug && !profile) return { error: "No se encontró el perfil profesional seleccionado." };

  try {
    const previous = await prisma.professionalHub.findUnique({ where: { id: hubId }, select: { slug: true } });
    if (!previous) return { error: "No se encontró el hub." };
    const hub = await prisma.professionalHub.update({
      where: { id: hubId },
      data: {
        ...parsed.data,
        professionalProfileId: profile?.id || null,
        ...(parsed.data.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
      select: { slug: true },
    });
    revalidateHub(previous.slug);
    revalidateHub(hub.slug);
    return { success: true };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya existe un hub con ese slug o perfil." };
    console.error("updateProfessionalHub error:", error);
    return { error: "No se pudo guardar el hub profesional." };
  }
}

export async function saveProfessionalHubModule(hubId, payload = {}) {
  await admin();
  const parsed = moduleData(payload);
  const id = String(payload.id || "");
  const parentId = String(hubId || "");
  if (!parentId) return { error: "Hub inválido." };
  if (parsed.error) return parsed;

  try {
    const existing = await prisma.professionalHubModule.findFirst({ where: { hubId: parentId, slug: parsed.data.slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
    if (existing) return { error: "Ya existe un módulo con ese slug en este hub." };
    const module = id
      ? await prisma.professionalHubModule.update({ where: { id }, data: parsed.data, select: { id: true } })
      : await prisma.professionalHubModule.create({ data: { ...parsed.data, hubId: parentId }, select: { id: true } });
    revalidateHub();
    return { success: true, id: module.id };
  } catch (error) {
    console.error("saveProfessionalHubModule error:", error);
    return { error: "No se pudo guardar el módulo." };
  }
}

export async function deleteProfessionalHubModule(id) {
  await admin();
  try {
    await prisma.professionalHubModule.delete({ where: { id: String(id || "") } });
    revalidateHub();
    return { success: true };
  } catch (error) {
    console.error("deleteProfessionalHubModule error:", error);
    return { error: "No se pudo eliminar el módulo." };
  }
}
