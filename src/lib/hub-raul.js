import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import hubData from "../../data/hub-raul.json";
import crisisData from "../../data/crisis-lines.json";
import { prisma } from "@/lib/prisma";
import { SELECT_TARIFA_PUBLICA, TARIFA_VIGENTE, rangoDePrecios } from "@/lib/service-pricing";

export const HUB_PATH = "raul-olmedo-evans";
export const RAUL_PERSON_ID = "https://saludmentalcostarica.com/profesionales/raul-olmedo#persona";

export function getHubData() {
  return hubData;
}

export function getPublishedHubTopics() {
  return hubData.temas.filter((tema) => tema.publicado);
}

const PUBLIC_HUB_INCLUDE = {
  professional: {
    select: {
      slug: true,
      licenseNumber: true,
      licensingBody: true,
      licenseVerificationUrl: true,
    },
  },
  modules: {
    where: { isVisible: true, isPublished: true },
    orderBy: { position: "asc" },
  },
};

function mapManagedHub(row) {
  if (!row) return null;

  const modules = row.modules || [];
  const topics = modules
    .filter((module) => module.type === "TOPIC")
    .map((module) => ({
      ...module.metadata,
      slug: module.slug,
      titulo: module.title,
      resumen: module.summary || "",
      publicado: module.isPublished,
      body: module.body || "",
    }));
  const treatment = modules.find((module) => module.type === "TREATMENT" || module.slug === "tratamiento-breve-15-sesiones");
  const profile = row.professional;

  return {
    nombre: row.name,
    url_hub: `/${row.slug}`,
    titulo: row.title || row.name,
    duracion_min: row.durationMin || hubData.duracion_min,
    modalidad: row.modality || hubData.modalidad,
    url_agenda: hubData.url_agenda,
    url_perfil: `/${row.profileSlug ? `profesionales/${row.profileSlug}` : hubData.url_perfil.replace(/^\//, "")}`,
    whatsapp: row.whatsapp || hubData.whatsapp,
    credencial: {
      colegio: profile?.licensingBody || hubData.credencial.colegio,
      numero: profile?.licenseNumber || hubData.credencial.numero,
      url_verificacion: profile?.licenseVerificationUrl || hubData.credencial.url_verificacion,
    },
    temas: topics,
    herramientas_habilitadas: Array.isArray(row.enabledFunctions) ? row.enabledFunctions : [],
    serie_destacada: row.featuredSeriesSlug || hubData.serie_destacada,
    actualizado: row.updatedAt instanceof Date ? row.updatedAt.toISOString().slice(0, 10) : hubData.actualizado,
    hero_video_url: row.heroVideoUrl || "",
    hero_poster_url: row.heroPosterUrl || "",
    logo_url: row.logoUrl || "",
    treatment: treatment
      ? {
          ...treatment.metadata,
          slug: treatment.slug,
          titulo: treatment.title,
          resumen: treatment.summary || "",
          body: treatment.body || "",
        }
      : null,
    _managed: true,
  };
}

/**
 * Lee el hub profesional publicado. El JSON histórico queda como fallback
 * para que un despliegue sea navegable antes de ejecutar la migración de datos.
 */
export async function getManagedHubData(slug = HUB_PATH) {
  try {
    const row = await prisma.professionalHub.findFirst({
      where: { slug: String(slug || "") },
      include: PUBLIC_HUB_INCLUDE,
    });
    if (row && (row.status !== "PUBLISHED" || !row.isActive)) return null;
    return row ? mapManagedHub(row) : getHubData();
  } catch {
    return getHubData();
  }
}

export async function getPublishedHubTopicsAsync(slug = HUB_PATH) {
  const hub = await getManagedHubData(slug);
  return (hub?.temas || []).filter((topic) => topic.publicado);
}

export async function readManagedHubDocument(slug, moduleSlug) {
  let managedRow = null;
  try {
    const row = await prisma.professionalHub.findFirst({
      where: { slug: String(slug || "") },
      include: {
        modules: {
          where: { slug: String(moduleSlug || ""), isVisible: true, isPublished: true },
          take: 1,
        },
      },
    });
    managedRow = row;
    const moduleRecord = row?.modules?.[0];
    if (row && (row.status !== "PUBLISHED" || !row.isActive)) return null;
    if (moduleRecord) {
      return {
        ...moduleRecord.metadata,
        titulo: moduleRecord.title,
        resumen: moduleRecord.summary || "",
        body: moduleRecord.body || "",
      };
    }
  } catch {
    // La lectura histórica de archivos mantiene la página disponible.
  }
  if (managedRow) return null;
  return readHubTheme(moduleSlug) || (moduleSlug === "tratamiento-breve-15-sesiones" ? readHubDocument(moduleSlug) : null);
}

export async function hubLastModifiedAsync(path) {
  const [slug, moduleSlug] = String(path || "").split("/");
  try {
    const row = await prisma.professionalHub.findFirst({
      where: { slug, status: "PUBLISHED", isActive: true },
      select: {
        updatedAt: true,
        modules: { where: { slug: moduleSlug }, select: { updatedAt: true }, take: 1 },
      },
    });
    return row?.modules?.[0]?.updatedAt || row?.updatedAt || hubLastModified(path);
  } catch {
    return hubLastModified(path);
  }
}

/** Un monto como lo escribe el hub: '₡30.000', con punto de miles. */
function montoHub(monto) {
  return `₡${new Intl.NumberFormat("es-CR").format(monto).replace(/\s/g, ".")}`;
}

/**
 * El precio que anuncia el hub, a partir de la tarifa aprobada del profesional.
 *
 * Antes salía de `data/hub-raul.json`: un ₡40.000 fijo que no se enteraba de
 * ningún cambio de tarifa, así que el hub, su página de 15 sesiones y el mensaje
 * de WhatsApp seguían anunciando el precio viejo. Sin rango —no hay tarifa
 * vigente o la base no respondió— devuelve vacío: es preferible no anunciar
 * precio a anunciar uno que no es.
 */
export function formatHubPrice(rango) {
  if (!rango) return "";
  return rango.min === rango.max ? montoHub(rango.min) : `${montoHub(rango.min)} – ${montoHub(rango.max)}`;
}

export function buildWaLink(origen = HUB_PATH, source = hubData, rango = null) {
  const precio = formatHubPrice(rango);
  const detalle = precio ? `${source.duracion_min} min, ${precio}` : `${source.duracion_min} min`;
  const text = `Hola, quiero agendar una sesión en línea con ${source.nombre} (${detalle}). ${origen}`;
  return `https://wa.me/${source.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function getCrisisData() {
  return crisisData;
}

function parseFrontMatterValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value.replaceAll("'", '"'));
    } catch {
      return value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return value.replace(/^(['"])(.*)\1$/, "$2");
}

export function parseHubMarkdown(source) {
  const normalized = String(source || "").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: normalized.trim() };

  const metadata = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (pair) metadata[pair[1]] = parseFrontMatterValue(pair[2]);
  }

  return { metadata, body: match[2].trim() };
}

export function readHubDocument(slug) {
  try {
    const filePath = join(process.cwd(), "content", "hub-raul", `${slug}.md`);
    const source = readFileSync(filePath, "utf8");
    const parsed = parseHubMarkdown(source);
    return { ...parsed.metadata, body: parsed.body };
  } catch {
    return null;
  }
}

export function readHubTheme(slug) {
  const tema = hubData.temas.find((item) => item.slug === slug && item.publicado);
  const document = tema ? readHubDocument(slug) : null;
  return document ? { ...tema, ...document } : null;
}

export function hubLastModified(path) {
  try {
    if (path === HUB_PATH || path === `${HUB_PATH}/tratamiento-breve-15-sesiones`) {
      return new Date(hubData.actualizado);
    }
    return statSync(join(process.cwd(), "content", "hub-raul", `${path.split("/").at(-1)}.md`)).mtime;
  } catch {
    return new Date(hubData.actualizado);
  }
}

/**
 * A dónde se agenda con Raúl y a qué precio: su primera consulta con tarifa
 * vigente. El botón y el precio salen de la misma asignación, así que el hub no
 * puede anunciar el valor de una consulta y mandar a agendar otra.
 */
export async function getRaulAgenda() {
  try {
    const profile = await prisma.professionalProfile.findFirst({
      where: { slug: "raul-olmedo", isApproved: true, user: { is: { isActive: true } } },
      select: {
        id: true,
        serviceAssignments: {
          where: {
            status: "APPROVED",
            service: { is: { isActive: true } },
            rates: { some: TARIFA_VIGENTE },
          },
          orderBy: { service: { displayOrder: "asc" } },
          select: { serviceId: true, rates: { where: TARIFA_VIGENTE, select: SELECT_TARIFA_PUBLICA } },
          take: 1,
        },
      },
    });
    const assignment = profile?.serviceAssignments?.[0];
    if (profile?.id && assignment?.serviceId) {
      return {
        url: `/agendar/${profile.id}?serviceId=${assignment.serviceId}`,
        rango: rangoDePrecios(assignment.rates),
      };
    }
    console.warn("Hub de Raúl sin consulta agendable con tarifa vigente:", { perfil: Boolean(profile?.id) });
  } catch (error) {
    // El hub sigue siendo navegable aunque la base no esté disponible durante el
    // build, pero sin precio: se registra para que no falle en silencio.
    console.error("No se pudo leer la agenda del hub de Raúl:", error?.message);
  }
  return { url: hubData.url_agenda, rango: null };
}

export async function getRaulAgendaUrl() {
  return (await getRaulAgenda()).url;
}

export async function getRaulProfile() {
  try {
    return await prisma.professionalProfile.findFirst({
      where: { slug: "raul-olmedo", isApproved: true, user: { is: { isActive: true } } },
      select: {
        bio: true,
        profileReview: true,
        user: { select: { name: true, image: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function getRaulWriting() {
  try {
    const profile = await prisma.professionalProfile.findUnique({ where: { slug: "raul-olmedo" }, select: { id: true } });
    if (!profile) return [];
    return prisma.post.findMany({
      where: { authorId: profile.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true, slug: true, excerpt: true },
    });
  } catch {
    return [];
  }
}
