import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = process.cwd();
const hub = JSON.parse(readFileSync(join(root, "data", "hub-raul.json"), "utf8"));

function parseValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
  return value.replace(/^(['"])(.*)\1$/, "$2");
}

function parseDocument(slug) {
  try {
    const source = readFileSync(join(root, "content", "hub-raul", `${slug}.md`), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { metadata: {}, body: source.trim() };
    const metadata = {};
    for (const line of match[1].split("\n")) {
      const pair = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (pair) metadata[pair[1]] = parseValue(pair[2]);
    }
    return { metadata, body: match[2].trim() };
  } catch {
    return { metadata: {}, body: "" };
  }
}

function moduleData({ slug, type, title, summary, published, position }) {
  const document = parseDocument(slug);
  return {
    slug,
    type,
    title: title || document.metadata.titulo || slug,
    summary: summary || document.metadata.resumen || document.metadata.meta || null,
    body: document.body || null,
    metadata: document.metadata,
    position,
    isVisible: true,
    isPublished: Boolean(published),
  };
}

async function main() {
  const profile = await prisma.professionalProfile.findUnique({ where: { slug: "raul-olmedo" }, select: { id: true } });
  const existing = await prisma.professionalHub.findUnique({ where: { slug: "raul-olmedo-evans" }, select: { id: true } });
  if (existing) {
    console.log("Hub de Raúl ya existe; no se sobrescribieron cambios del administrador.");
    return;
  }

  const modules = hub.temas.map((topic, index) => moduleData({
    slug: topic.slug,
    type: "TOPIC",
    title: topic.titulo,
    summary: topic.resumen,
    published: topic.publicado,
    position: index,
  }));
  modules.push(moduleData({
    slug: "tratamiento-breve-15-sesiones",
    type: "TREATMENT",
    title: "Tratamiento breve de 15 sesiones",
    summary: "Un formato de trabajo acotado para explorar angustia y duelo.",
    published: true,
    position: hub.temas.length,
  }));

  const created = await prisma.professionalHub.create({
    data: {
      professionalProfileId: profile?.id || null,
      slug: "raul-olmedo-evans",
      name: hub.nombre,
      title: hub.titulo,
      profileSlug: "raul-olmedo",
      whatsapp: hub.whatsapp,
      modality: hub.modalidad,
      durationMin: hub.duracion_min,
      featuredSeriesSlug: hub.serie_destacada,
      heroVideoUrl: "/videos/hub-raul-monstera.mp4",
      heroPosterUrl: "/images/hub-raul-poster.jpeg",
      logoUrl: "/brand/leaf-coral.svg",
      enabledFunctions: ["agenda", "whatsapp", "topics", "treatment", "writing", "help"],
      status: "PUBLISHED",
      publishedAt: new Date(),
      modules: { create: modules },
    },
    select: { id: true, slug: true },
  });
  console.log(`Hub migrado: ${created.slug} (${modules.length} módulos).`);
}

main().catch((error) => {
  console.error("Migración del hub fallida:", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
