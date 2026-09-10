import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import hubData from "../../data/hub-raul.json";
import crisisData from "../../data/crisis-lines.json";
import { prisma } from "@/lib/prisma";
import { TARIFA_VIGENTE } from "@/lib/service-pricing";

export const HUB_PATH = "raul-olmedo";
export const RAUL_PERSON_ID = "https://saludmentalcostarica.com/profesionales/raul-olmedo#persona";

export function getHubData() {
  return hubData;
}

export function getPublishedHubTopics() {
  return hubData.temas.filter((tema) => tema.publicado);
}

export function formatHubPrice() {
  const formatted = new Intl.NumberFormat("es-CR").format(hubData.precio_crc).replace(/\u00a0/g, ".");
  return `₡${formatted}`;
}

export function buildWaLink(origen = HUB_PATH) {
  const text = `Hola, quiero agendar una sesión en línea con Raúl Olmedo (${hubData.duracion_min} min, ${formatHubPrice()}). ${origen}`;
  return `https://wa.me/${hubData.whatsapp}?text=${encodeURIComponent(text)}`;
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
  const normalized = String(source || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
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
    if (path === "raul-olmedo" || path === "raul-olmedo/tratamiento-breve-15-sesiones") {
      return new Date(hubData.actualizado);
    }
    return statSync(join(process.cwd(), "content", "hub-raul", `${path.split("/").at(-1)}.md`)).mtime;
  } catch {
    return new Date(hubData.actualizado);
  }
}

export async function getRaulAgendaUrl() {
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
          select: { serviceId: true },
          take: 1,
        },
      },
    });
    const service = profile?.serviceAssignments?.[0];
    if (profile?.id && service?.serviceId) return `/agendar/${profile.id}?serviceId=${service.serviceId}`;
  } catch {
    // El hub sigue siendo navegable aunque la base no esté disponible durante el build.
  }
  return hubData.url_agenda;
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
