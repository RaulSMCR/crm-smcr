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
  if (!intro) {
    const oculta = (data.sections || []).some((section) => section.type === "EDITORIAL_INTRO" && cleanTopicText(section.body));
    issues.push(oculta
      ? "La sección «Introducción editorial» está oculta: en «Secciones del hub» marcá «Visible» y guardala."
      : "Ninguna sección es de tipo «Introducción editorial». En «Secciones del hub», cambiá el Tipo de la sección principal a «Introducción editorial» y guardala, o agregá tipo_seccion: \"EDITORIAL_INTRO\" al .md y volvé a importarlo.");
  }

  const relatedCount = Number(data.postCount || 0) + Number(data.serviceCount || 0) + Number(data.perspectiveCount || 0);
  if (relatedCount < 1) issues.push("Falta contenido relacionado: en «Contenido relacionado» asigná al menos un artículo publicado, un servicio o una perspectiva.");

  return issues;
}

/**
 * Orden de los bloques de la página de un hub.
 *
 * Los bloques que tienen una sección propia en el editor salen en el orden de
 * su «Posición»; un empate lo resuelve el orden de referencia de los tipos.
 * Los bloques que aparecen sin sección propia (preguntas, servicios o
 * profesionales que existen por sus relaciones) van después, en el orden de
 * referencia. El cierre no entra acá: siempre va último.
 *
 * @param {Array<{key: string, rank: number, position: number|null|undefined}>} bloques
 */
export function ordenarBloquesHub(bloques) {
  const conPosicion = (b) => Number.isFinite(b.position);
  return [...bloques].sort((a, b) => {
    if (conPosicion(a) !== conPosicion(b)) return conPosicion(a) ? -1 : 1;
    if (conPosicion(a) && a.position !== b.position) return a.position - b.position;
    return a.rank - b.rank;
  });
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
