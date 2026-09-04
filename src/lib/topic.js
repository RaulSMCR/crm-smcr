import { slugify } from "@/lib/slug";

// Todo slug de un hub ocupa la raíz del sitio. Estos segmentos ya tienen una
// ruta propia y no deben poder ocultarla bajo una fila de Topic.
export const RESERVED_TOPIC_SLUGS = Object.freeze([
  "api", "agendar", "blog", "cambiar-password", "contacto", "cookies",
  "espera-aprobacion", "faq", "favicon.ico", "ingresar", "mi", "og", "panel", "profesionales",
  "privacidad", "recuperar", "registro", "servicios", "terminos",
  "verificar-email",
]);

const RESERVED = new Set(RESERVED_TOPIC_SLUGS);

export function normalizeTopicSlug(value) {
  return slugify(String(value || "").trim());
}

export function isReservedTopicSlug(value) {
  return RESERVED.has(normalizeTopicSlug(value));
}

export function validateTopicSlug(value) {
  const slug = normalizeTopicSlug(value);
  if (!slug) return "El slug es obligatorio.";
  if (isReservedTopicSlug(slug)) return `El slug «${slug}» está reservado por una ruta del sitio.`;
  if (slug.length > 80) return "El slug no puede superar 80 caracteres.";
  return null;
}

export const TOPIC_SECTION_TYPES = Object.freeze([
  "HERO",
  "USER_SITUATIONS",
  "EDITORIAL_INTRO",
  "FEATURED_ARTICLES",
  "EXPLORE_TOPIC",
  "PERSPECTIVES",
  "VIDEO",
  "PODCAST",
  "FAQ",
  "PROFESSIONALS",
  "SERVICES",
  "RELATED_TOPICS",
  "CTA",
  "CUSTOM_RICH_TEXT",
]);

export function cleanTopicText(value, max = 20000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function safeTopicMediaUrl(value) {
  const raw = cleanTopicText(value, 2000);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return raw;
  } catch {
    return null;
  }
}

export function topicPublicationIssues(topic, data = {}) {
  const issues = [];
  if (!cleanTopicText(topic?.title, 200).length) issues.push("Falta el título del hub.");
  if (!cleanTopicText(topic?.excerpt, 500).length) issues.push("Falta el extracto editorial.");
  if (!cleanTopicText(topic?.metaTitle, 200).length) issues.push("Falta el título SEO.");
  if (!cleanTopicText(topic?.metaDescription, 500).length) issues.push("Falta la meta description.");
  if (cleanTopicText(topic?.heroImage, 2000).length && !cleanTopicText(topic?.heroImageAlt, 300).length) issues.push("La imagen hero necesita texto alternativo.");

  const intro = (data.sections || []).find(
    (section) => section.type === "EDITORIAL_INTRO" && section.isVisible !== false && cleanTopicText(section.body),
  );
  if (!intro) issues.push("Debe existir una sección visible de introducción editorial.");

  const relatedCount = Number(data.postCount || 0) + Number(data.serviceCount || 0) + Number(data.perspectiveCount || 0);
  if (relatedCount < 1) issues.push("Debe existir al menos un contenido relacionado aprobado.");

  return issues;
}

export function topicSectionLabel(type) {
  return {
    HERO: "Hero",
    USER_SITUATIONS: "Qué te puede estar pasando",
    EDITORIAL_INTRO: "Introducción editorial",
    FEATURED_ARTICLES: "Artículos destacados",
    EXPLORE_TOPIC: "Explorar este tema",
    PERSPECTIVES: "Perspectivas interdisciplinarias",
    VIDEO: "Video",
    PODCAST: "Podcast / audio",
    FAQ: "Preguntas frecuentes",
    PROFESSIONALS: "Profesionales",
    SERVICES: "Servicios",
    RELATED_TOPICS: "Temas relacionados",
    CTA: "Llamado a la acción",
    CUSTOM_RICH_TEXT: "Texto enriquecido",
  }[type] || type;
}
