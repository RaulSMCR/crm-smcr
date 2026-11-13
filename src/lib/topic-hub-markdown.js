import { normalizeTopicSlug, safeTopicMediaUrl, TOPIC_SECTION_TYPES } from "@/lib/topic";
import { contieneFraseProhibida, esNombreMarkdown, leerEnlacesInternos, parseFrontmatter, partirDocumento, slugDeArchivo, validarCuerpo } from "@/lib/hub-markdown";

const CAMPOS_HUB = {
  nombre: "name", titulo: "title", subtitulo: "subtitle", resumen: "excerpt",
  descripcion: "excerpt", titulo_seo: "metaTitle", meta: "metaDescription",
  imagen_hero: "heroImage", imagen_alt: "heroImageAlt", video_url: "introVideoUrl", podcast_url: "podcastUrl",
};
const LIMITES = { name: 160, title: 200, subtitle: 300, excerpt: 1000, metaTitle: 60, metaDescription: 155, heroImage: 2000, heroImageAlt: 300, introVideoUrl: 2000, podcastUrl: 2000 };
const TIPOS_POR_NOMBRE = Object.fromEntries(TOPIC_SECTION_TYPES.map((tipo) => [tipo.toLowerCase().replaceAll("_", "-"), tipo]));
Object.assign(TIPOS_POR_NOMBRE, { "introduccion-editorial": "EDITORIAL_INTRO", "situaciones": "USER_SITUATIONS", "texto-adicional": "CUSTOM_RICH_TEXT" });
const ANCLAS = { USER_SITUATIONS: "situaciones", EDITORIAL_INTRO: "introduccion", FEATURED_ARTICLES: "destacados", EXPLORE_TOPIC: "explorar", PERSPECTIVES: "perspectivas", VIDEO: "video", PODCAST: "podcast", FAQ: "preguntas", PROFESSIONALS: "profesionales", SERVICES: "servicios", RELATED_TOPICS: "relacionados", CTA: "cierre", HERO: "portada" };

export function topicSectionAnchor(type, slug) {
  return ANCLAS[type] || slug;
}

export function topicCustomSections(sections = []) {
  const editoriales = sections.filter((section) => section.type === "CUSTOM_RICH_TEXT" && section.config?.ingesta?.slug !== "_hub");
  const primera = editoriales[0];
  return editoriales.filter((section) => section.isVisible && section.body && (section.config?.ingesta?.slug || section.id === primera?.id));
}

export function parseTopicHubDocument(source, nombre, { feed = false } = {}) {
  const { frontmatter, body, tieneFrontmatter } = partirDocumento(source);
  const fm = parseFrontmatter(frontmatter);
  const bloqueos = [];
  const avisos = [];
  const base = slugDeArchivo(nombre);
  const slug = base === "hub" || fm.tipo === "hub" ? "_hub" : normalizeTopicSlug(base);
  const clase = slug === "_hub" ? "hub" : "seccion";
  const payload = {};
  if (/\s*\(\d+\)$/.test(base)) avisos.push(`el nombre parece una copia descargada; usá el nombre original del archivo si querés el destino «${normalizeTopicSlug(base.replace(/\s*\(\d+\)$/, ""))}»`);
  if (!esNombreMarkdown(nombre) || feed && !/\.md$/i.test(nombre)) bloqueos.push("el archivo debe ser Markdown (.md para el feed)");
  if (!tieneFrontmatter) bloqueos.push("el archivo no trae frontmatter entre --- y ---");
  if (String(source).includes("\u0000")) bloqueos.push("el archivo contiene bytes nulos");
  if (!slug || slug.length > 80) bloqueos.push("el nombre debe identificar una sección de hasta 80 caracteres");
  if (contieneFraseProhibida(source)) bloqueos.push("el documento contiene la frase plural prohibida por el contrato del sitio");
  if ("publicado" in fm || "estado" in fm || "status" in fm) avisos.push("la publicación se cambia manualmente desde el editor del hub");
  validarCuerpo({ body, avisos, bloqueos });
  if (/\{\{\s*(precio_sesion|duracion_sesion|whatsapp)\s*\}\}/.test(body)) bloqueos.push("las variables de sesión requieren un hub profesional; esta sección pertenece a un hub de contenido");
  if (body.length > 30000) bloqueos.push("el cuerpo supera 30.000 caracteres; no se recorta el texto");
  if (/(?:[$€₡]\s*\d|\b\d[\d.,]*\s*(?:colones|dólares|euros)\b|(?<!\d)(?:\+?506[\s-]*)?[2-8]\d{3}[\s-]?\d{4}(?!\d))/iu.test(body)) bloqueos.push("el cuerpo contiene un precio o teléfono literal");
  if (fm.titulo_seo !== undefined && (typeof fm.titulo_seo !== "string" || fm.titulo_seo.length > 60)) bloqueos.push("«titulo_seo» debe ser texto de hasta 60 caracteres");
  if (fm.meta !== undefined && (typeof fm.meta !== "string" || fm.meta.length < 120 || fm.meta.length > 155)) bloqueos.push("«meta» debe tener entre 120 y 155 caracteres");
  for (const campo of ["destacada", "no_indexar"]) {
    if (fm[campo] !== undefined && typeof fm[campo] !== "boolean") bloqueos.push(`«${campo}» debe ser true o false`);
  }
  for (const campo of ["busqueda_objetivo", "imagen_social", "seccion_id"]) {
    if (fm[campo] !== undefined && typeof fm[campo] !== "string") bloqueos.push(`«${campo}» debe ser texto`);
  }
  if (clase === "hub") {
    for (const [campo, columna] of Object.entries(CAMPOS_HUB)) {
      if (fm[campo] === undefined) continue;
      if (typeof fm[campo] !== "string" || fm[campo].trim().length > LIMITES[columna]) bloqueos.push(`«${campo}» debe ser texto de hasta ${LIMITES[columna]} caracteres`);
      else payload[columna] = fm[campo].trim() || null;
    }
    if ("name" in payload && (!payload.name || payload.name.length < 2)) bloqueos.push("«nombre» necesita al menos dos caracteres");
    if (fm.destacada !== undefined) payload.featured = fm.destacada;
    if ("slug" in fm) avisos.push("la ruta del hub se conserva; su slug se cambia desde el formulario");
    if (body) bloqueos.push("_hub.md configura la portada mediante frontmatter; el cuerpo va en archivos de sección");
  } else {
    if (fm.titulo !== undefined) {
      if (typeof fm.titulo !== "string" || !fm.titulo.trim() || fm.titulo.length > 200) bloqueos.push("«titulo» debe ser texto de entre 1 y 200 caracteres");
      else payload.title = fm.titulo.trim();
    }
    if (body) payload.body = body;
    const tipo = fm.tipo_seccion || fm.tipo;
    if (tipo && !["seccion", "tema", "personalizado", "tratamiento"].includes(tipo)) {
      payload.type = TOPIC_SECTION_TYPES.includes(tipo) ? tipo : TIPOS_POR_NOMBRE[String(tipo).toLowerCase()];
      if (!payload.type) bloqueos.push(`tipo de sección no reconocido: «${tipo}»`);
    } else if (TIPOS_POR_NOMBRE[base]) payload.type = TIPOS_POR_NOMBRE[base];
    if (fm.visible !== undefined || fm.publicado !== undefined) avisos.push("la visibilidad de las secciones se cambia manualmente en el editor");
  }
  if (fm.orden !== undefined) {
    if (!Number.isInteger(fm.orden) || fm.orden < 0) bloqueos.push("«orden» debe ser un entero no negativo");
    else payload[clase === "hub" ? "order" : "position"] = fm.orden;
  }
  for (const campo of ["imagen_hero", "video_url", "podcast_url", "imagen_social"]) {
    if (fm[campo] && !safeTopicMediaUrl(fm[campo])) bloqueos.push(`«${campo}» debe ser una ruta desde / o una URL HTTPS`);
  }
  if (fm.articulos_relacionados !== undefined && (!Array.isArray(fm.articulos_relacionados) || fm.articulos_relacionados.some((item) => typeof item !== "string"))) bloqueos.push("«articulos_relacionados» debe ser una lista de rutas o slugs");
  const metadatos = Object.fromEntries(Object.entries(fm).filter(([clave]) => !["tipo", "tipo_seccion", "seccion_id", "publicado", "estado", "status", "visible", "slug", "orden", ...Object.keys(CAMPOS_HUB)].includes(clave)));
  // El SEO de una sección se conserva como metadatos editoriales. La URL y el
  // SEO público pertenecen a la portada, configurada mediante _hub.md.
  if (clase === "seccion") for (const campo of ["titulo_seo", "meta", "resumen"]) if (campo in fm) metadatos[campo] = fm[campo];
  return { clase, slug, payload, metadatos, bloqueos, avisos, enlaces: leerEnlacesInternos(body), relacionados: Array.isArray(fm.articulos_relacionados) ? fm.articulos_relacionados.filter((item) => typeof item === "string") : [], seccionId: typeof fm.seccion_id === "string" ? fm.seccion_id : null };
}

export function topicHubSeo(sections = []) {
  const metadata = sections.find((section) => section.config?.ingesta?.slug === "_hub")?.config?.ingesta?.metadatos || {};
  return { ogImage: metadata.imagen_social || "", noindex: metadata.no_indexar === true, focusKeyword: metadata.busqueda_objetivo || "" };
}
