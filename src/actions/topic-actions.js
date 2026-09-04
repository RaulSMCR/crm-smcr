"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { registrarRedirect, TIPOS } from "@/lib/slug-redirect";
import {
  cleanTopicText,
  normalizeTopicSlug,
  TOPIC_SECTION_TYPES,
  topicPublicationIssues,
  safeTopicMediaUrl,
  validateTopicSlug,
} from "@/lib/topic";

const TOPIC_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const PERSPECTIVE_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") throw new Error("No autorizado: se requiere rol ADMIN.");
}

async function admin() {
  const session = await getSession();
  requireAdmin(session);
  return session;
}

function text(value, max = 20000) {
  return cleanTopicText(value, max) || null;
}

function int(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function topicCore(payload = {}) {
  const name = cleanTopicText(payload.name, 160);
  const slug = normalizeTopicSlug(payload.slug || name);
  const slugError = validateTopicSlug(slug);
  if (name.length < 2) return { error: "El nombre debe tener al menos 2 caracteres." };
  if (slugError) return { error: slugError };

  const status = String(payload.status || "DRAFT");
  if (!TOPIC_STATUSES.has(status)) return { error: "Estado de tema inválido." };

  return {
    data: {
      name,
      slug,
      title: text(payload.title, 200),
      subtitle: text(payload.subtitle, 300),
      excerpt: text(payload.excerpt, 1000),
      heroImage: text(payload.heroImage, 2000),
      heroImageAlt: text(payload.heroImageAlt, 300),
      introVideoUrl: safeTopicMediaUrl(payload.introVideoUrl),
      podcastUrl: safeTopicMediaUrl(payload.podcastUrl),
      metaTitle: text(payload.metaTitle, 200),
      metaDescription: text(payload.metaDescription, 500),
      featured: Boolean(payload.featured),
      order: int(payload.order),
      status,
    },
  };
}

function revalidateTopic(slug) {
  revalidatePath("/panel/admin/temas");
  revalidatePath("/panel/admin/temas/[id]", "page");
  revalidatePath("/[slug]", "page");
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/${slug}`);
}

export async function createTopicHub(payload = {}) {
  await admin();
  const parsed = topicCore(payload);
  if (parsed.error) return parsed;

  try {
    const topic = await prisma.topic.create({ data: parsed.data, select: { id: true, slug: true } });
    revalidateTopic(topic.slug);
    return { success: true, id: topic.id, slug: topic.slug };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya existe un tema con ese nombre o slug." };
    console.error("createTopicHub error:", error);
    return { error: "No se pudo crear el hub." };
  }
}

export async function updateTopicHub(id, payload = {}) {
  await admin();
  const topicId = String(id || "");
  if (!topicId) return { error: "Tema inválido." };
  const parsed = topicCore(payload);
  if (parsed.error) return parsed;

  const previous = await prisma.topic.findUnique({ where: { id: topicId }, select: { slug: true } });
  if (!previous) return { error: "No se encontró el tema." };

  if (parsed.data.status === "PUBLISHED") {
    const current = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        sections: true,
        posts: { where: { status: "APPROVED", post: { status: "PUBLISHED", noindex: false } }, select: { postId: true } },
        services: { where: { service: { isActive: true, noindex: false } }, select: { serviceId: true } },
        perspectives: { where: { status: "PUBLISHED" }, select: { id: true } },
        _count: { select: { posts: true, services: true, perspectives: true } },
      },
      });
    const issues = topicPublicationIssues({ ...current, ...parsed.data }, {
      sections: current.sections,
      postCount: current.posts.length,
      serviceCount: current.services.length,
      perspectiveCount: current.perspectives.length,
    });
    if (issues.length) return { error: `No se puede publicar: ${issues.join(" ")}` };
  }

  try {
    const topic = await prisma.$transaction(async (tx) => {
      const updated = await tx.topic.update({
        where: { id: topicId },
        data: {
          ...parsed.data,
          ...(parsed.data.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        },
        select: { slug: true },
      });
      if (previous.slug !== updated.slug) await registrarRedirect(TIPOS.TOPIC, previous.slug, updated.slug, tx);
      return updated;
    });
    revalidateTopic(previous.slug);
    revalidateTopic(topic.slug);
    return { success: true, slug: topic.slug };
  } catch (error) {
    if (error?.code === "P2002") return { error: "Ya existe un tema con ese nombre o slug." };
    console.error("updateTopicHub error:", error);
    return { error: "No se pudo guardar el hub." };
  }
}

export async function publishTopic(id) {
  await admin();
  const topicId = String(id || "");
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      sections: true,
      posts: { where: { status: "APPROVED", post: { status: "PUBLISHED", noindex: false } }, select: { postId: true } },
      services: { where: { service: { isActive: true, noindex: false } }, select: { serviceId: true } },
      perspectives: { where: { status: "PUBLISHED" }, select: { id: true } },
      _count: { select: { posts: true, services: true, perspectives: true } },
    },
  });
  if (!topic) return { error: "No se encontró el tema." };

  const issues = topicPublicationIssues(topic, {
    sections: topic.sections,
    postCount: topic.posts.length,
    serviceCount: topic.services.length,
    perspectiveCount: topic.perspectives.length,
  });
  if (issues.length) return { error: `No se puede publicar: ${issues.join(" ")}` };

  await prisma.topic.update({ where: { id: topicId }, data: { status: "PUBLISHED", publishedAt: topic.publishedAt || new Date() } });
  revalidateTopic(topic.slug);
  return { success: true };
}

export async function archiveTopic(id) {
  await admin();
  const topic = await prisma.topic.update({ where: { id: String(id || "") }, data: { status: "ARCHIVED" }, select: { slug: true } });
  revalidateTopic(topic.slug);
  return { success: true };
}

export async function saveTopicSection(topicId, payload = {}) {
  await admin();
  const id = String(payload.id || "");
  const type = String(payload.type || "");
  if (!TOPIC_SECTION_TYPES.includes(type)) return { error: "Tipo de sección inválido." };
  if (!String(topicId || "")) return { error: "Tema inválido." };

  const data = {
    topicId: String(topicId),
    type,
    title: text(payload.title, 200),
    body: text(payload.body, 30000),
    position: int(payload.position),
    isVisible: payload.isVisible !== false,
    // El renderer no interpreta config. Solo se persiste un objeto JSON acotado.
    config: payload.config && typeof payload.config === "object" && !Array.isArray(payload.config) ? payload.config : undefined,
  };

  try {
    const section = id
      ? await prisma.topicSection.update({ where: { id }, data, select: { id: true } })
      : await prisma.topicSection.create({ data, select: { id: true } });
    revalidateTopic();
    return { success: true, id: section.id };
  } catch (error) {
    console.error("saveTopicSection error:", error);
    return { error: "No se pudo guardar la sección." };
  }
}

export async function deleteTopicSection(id) {
  await admin();
  await prisma.topicSection.delete({ where: { id: String(id || "") } });
  revalidateTopic();
  return { success: true };
}

export async function saveTopicPost(topicId, postId, payload = {}) {
  await admin();
  const tId = String(topicId || "");
  const pId = String(postId || "");
  const role = payload.role === "PRIMARY" ? "PRIMARY" : "SUPPORTING";
  const topic = await prisma.topic.findUnique({ where: { id: tId }, select: { slug: true } });
  const post = await prisma.post.findUnique({ where: { id: pId }, select: { id: true } });
  if (!topic || !post) return { error: "Tema o artículo inválido." };

  await prisma.$transaction(async (tx) => {
    if (role === "PRIMARY") {
      await tx.postTopic.updateMany({ where: { postId: pId, NOT: { topicId: tId } }, data: { role: "SUPPORTING" } });
    }
    await tx.postTopic.upsert({
      where: { postId_topicId: { postId: pId, topicId: tId } },
      create: { postId: pId, topicId: tId, status: "APPROVED", role, featured: Boolean(payload.featured), position: int(payload.position) },
      update: { status: "APPROVED", role, featured: Boolean(payload.featured), position: int(payload.position) },
    });
  });
  revalidateTopic(topic.slug);
  return { success: true };
}

export async function removeTopicPost(topicId, postId) {
  await admin();
  await prisma.postTopic.delete({ where: { postId_topicId: { postId: String(postId || ""), topicId: String(topicId || "") } } });
  revalidateTopic();
  return { success: true };
}

export async function saveTopicService(topicId, serviceId, payload = {}) {
  await admin();
  const tId = String(topicId || "");
  const sId = String(serviceId || "");
  const topic = await prisma.topic.findUnique({ where: { id: tId }, select: { slug: true } });
  const service = await prisma.service.findUnique({ where: { id: sId }, select: { id: true } });
  if (!topic || !service) return { error: "Tema o servicio inválido." };
  await prisma.topicService.upsert({
    where: { topicId_serviceId: { topicId: tId, serviceId: sId } },
    create: { topicId: tId, serviceId: sId, featured: Boolean(payload.featured), position: int(payload.position) },
    update: { featured: Boolean(payload.featured), position: int(payload.position) },
  });
  revalidateTopic(topic.slug);
  return { success: true };
}

export async function removeTopicService(topicId, serviceId) {
  await admin();
  await prisma.topicService.delete({ where: { topicId_serviceId: { topicId: String(topicId || ""), serviceId: String(serviceId || "") } } });
  revalidateTopic();
  return { success: true };
}

export async function saveTopicPerspective(topicId, payload = {}) {
  await admin();
  const tId = String(topicId || "");
  const dId = String(payload.disciplineId || "");
  const title = cleanTopicText(payload.title, 200);
  const content = cleanTopicText(payload.content, 30000);
  const status = String(payload.status || "DRAFT");
  if (!tId || !dId || title.length < 2 || content.length < 2) return { error: "La perspectiva necesita disciplina, título y contenido." };
  if (!PERSPECTIVE_STATUSES.has(status)) return { error: "Estado de perspectiva inválido." };
  try {
    const perspective = await prisma.topicPerspective.create({
      data: { topicId: tId, disciplineId: dId, title, content, status, position: int(payload.position) },
      select: { id: true },
    });
    revalidateTopic();
    return { success: true, id: perspective.id };
  } catch (error) {
    console.error("saveTopicPerspective error:", error);
    return { error: "No se pudo guardar la perspectiva." };
  }
}

export async function updateTopicPerspective(id, payload = {}) {
  await admin();
  const status = String(payload.status || "DRAFT");
  if (!PERSPECTIVE_STATUSES.has(status)) return { error: "Estado de perspectiva inválido." };
  try {
    await prisma.topicPerspective.update({
      where: { id: String(id || "") },
      data: {
        title: cleanTopicText(payload.title, 200),
        content: cleanTopicText(payload.content, 30000),
        status,
        position: int(payload.position),
      },
    });
    revalidateTopic();
    return { success: true };
  } catch (error) {
    console.error("updateTopicPerspective error:", error);
    return { error: "No se pudo actualizar la perspectiva." };
  }
}

export async function deleteTopicPerspective(id) {
  await admin();
  await prisma.topicPerspective.delete({ where: { id: String(id || "") } });
  revalidateTopic();
  return { success: true };
}

export async function saveTopicFaq(topicId, payload = {}) {
  await admin();
  const data = {
    topicId: String(topicId || ""),
    question: cleanTopicText(payload.question, 500),
    answer: cleanTopicText(payload.answer, 10000),
    position: int(payload.position),
    isVisible: payload.isVisible !== false,
  };
  if (!data.topicId || data.question.length < 4 || data.answer.length < 4) return { error: "La pregunta y la respuesta son obligatorias." };
  try {
    const faq = payload.id
      ? await prisma.topicFaq.update({ where: { id: String(payload.id) }, data, select: { id: true } })
      : await prisma.topicFaq.create({ data, select: { id: true } });
    revalidateTopic();
    return { success: true, id: faq.id };
  } catch (error) {
    console.error("saveTopicFaq error:", error);
    return { error: "No se pudo guardar la pregunta." };
  }
}

export async function deleteTopicFaq(id) {
  await admin();
  await prisma.topicFaq.delete({ where: { id: String(id || "") } });
  revalidateTopic();
  return { success: true };
}

export async function linkTopicRelation(sourceTopicId, targetTopicId, position = 0) {
  await admin();
  const source = String(sourceTopicId || "");
  const target = String(targetTopicId || "");
  if (!source || !target || source === target) return { error: "Elegí dos temas distintos." };
  const topics = await prisma.topic.findMany({ where: { id: { in: [source, target] } }, select: { id: true } });
  if (topics.length !== 2) return { error: "Uno de los temas no existe." };

  const existing = await prisma.topicRelation.findFirst({
    where: { OR: [{ sourceTopicId: source, targetTopicId: target }, { sourceTopicId: target, targetTopicId: source }] },
    select: { id: true },
  });
  if (existing) return { success: true };

  await prisma.topicRelation.create({ data: { sourceTopicId: source, targetTopicId: target, position: int(position) } });
  revalidateTopic();
  return { success: true };
}

export async function unlinkTopicRelation(sourceTopicId, targetTopicId) {
  await admin();
  const source = String(sourceTopicId || "");
  const target = String(targetTopicId || "");
  await prisma.topicRelation.deleteMany({
    where: { OR: [{ sourceTopicId: source, targetTopicId: target }, { sourceTopicId: target, targetTopicId: source }] },
  });
  revalidateTopic();
  return { success: true };
}
