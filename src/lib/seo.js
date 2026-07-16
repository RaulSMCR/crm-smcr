/**
 * SEO on-page en un solo lugar.
 *
 * Dos responsabilidades:
 *   1. Construir el objeto `metadata` de Next de forma uniforme, respetando el
 *      control editorial (metaTitle/metaDescription/ogImage/noindex) con fallback
 *      automático al contenido cuando el campo va vacío.
 *   2. Puntuar una pieza de contenido para la rutina diaria de SEO del panel de
 *      marketing (longitudes, presencia de excerpt/imagen, palabra clave objetivo).
 *
 * Todo lo de puntuación es puro y testeable (tests/unit/seo.test.js). Reutiliza
 * `siteUrl` de site-url.js para el canónico.
 */
import { SITE_URL, siteUrl } from "@/lib/site-url";

/** Rangos recomendados en caracteres. */
export const SEO_LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 70, max: 160 },
};

const DEFAULT_OG_IMAGE = "/og-image.png";
const SITE_NAME = "Salud Mental Costa Rica";

/** Recorta a un largo máximo respetando palabras, sin cortar a mitad. */
function clampText(str, max) {
  const value = String(str || "").trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : v;
    if (s) return s;
  }
  return "";
}

/**
 * Resuelve los valores SEO efectivos de una entidad (Post/Service/Professional)
 * aplicando el override editorial sobre los fallbacks del contenido.
 *
 * @param {object} entity  registro con posibles campos metaTitle, metaDescription, ogImage, focusKeyword, noindex
 * @param {object} fallbacks  { title, description, image, imageAlt }
 */
export function resolveSeo(entity = {}, fallbacks = {}) {
  const title = firstNonEmpty(entity.metaTitle, fallbacks.title);
  const description = clampText(
    firstNonEmpty(entity.metaDescription, fallbacks.description),
    SEO_LIMITS.description.max,
  );
  const image = firstNonEmpty(entity.ogImage, fallbacks.image, DEFAULT_OG_IMAGE);
  const imageAlt = firstNonEmpty(fallbacks.imageAlt, title, SITE_NAME);

  return {
    title,
    description,
    image,
    imageAlt,
    focusKeyword: firstNonEmpty(entity.focusKeyword, ""),
    noindex: Boolean(entity.noindex),
  };
}

/**
 * Construye un objeto `metadata` de Next completo y consistente.
 * Centraliza el patrón que hoy se repite a mano en cada página.
 *
 * @param {object} opts { title, description, path, image, imageAlt, type, noindex, keywords }
 */
export function buildMetadata({
  title,
  description,
  path = "",
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  type = "website",
  noindex = false,
  keywords,
} = {}) {
  const canonical = siteUrl(path);
  const cleanDescription = clampText(description, SEO_LIMITS.description.max);
  const ogImages = [{ url: image, width: 1200, height: 630, alt: imageAlt || title || SITE_NAME }];

  const metadata = {
    title,
    description: cleanDescription,
    alternates: { canonical },
    openGraph: {
      title: title ? `${title} | ${SITE_NAME}` : SITE_NAME,
      description: cleanDescription,
      url: canonical,
      type,
      siteName: SITE_NAME,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: title || SITE_NAME,
      description: cleanDescription,
      images: ogImages.map((i) => i.url),
    },
  };

  if (keywords && keywords.length) metadata.keywords = keywords;
  if (noindex) metadata.robots = { index: false, follow: false };

  return metadata;
}

// ---------------------------------------------------------------------------
// Auditoría (rutina diaria) — funciones puras
// ---------------------------------------------------------------------------

const LEVEL = { OK: "ok", WARN: "warn", ERROR: "error" };

/** Puntúa la longitud del título contra SEO_LIMITS.title. */
export function scoreTitle(str) {
  const len = String(str || "").trim().length;
  if (len === 0) return { level: LEVEL.ERROR, len, label: "Sin título SEO" };
  if (len < SEO_LIMITS.title.min) return { level: LEVEL.WARN, len, label: `Título corto (${len})` };
  if (len > SEO_LIMITS.title.max) return { level: LEVEL.WARN, len, label: `Título largo (${len})` };
  return { level: LEVEL.OK, len, label: `Título OK (${len})` };
}

/** Puntúa la longitud de la meta description contra SEO_LIMITS.description. */
export function scoreDescription(str) {
  const len = String(str || "").trim().length;
  if (len === 0) return { level: LEVEL.ERROR, len, label: "Sin descripción" };
  if (len < SEO_LIMITS.description.min) return { level: LEVEL.WARN, len, label: `Descripción corta (${len})` };
  if (len > SEO_LIMITS.description.max) return { level: LEVEL.WARN, len, label: `Descripción larga (${len})` };
  return { level: LEVEL.OK, len, label: `Descripción OK (${len})` };
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** ¿Aparece `keyword` dentro de `haystack`? (case/acentos-insensible) */
export function checkKeyword(haystack, keyword) {
  const kw = normalize(keyword);
  if (!kw) return false;
  return normalize(haystack).includes(kw);
}

/**
 * Audita una pieza de contenido y devuelve la lista de problemas + severidad.
 * `severity` = nº de issues con level 'error' o 'warn' (para ordenar "lo peor primero").
 *
 * @param {object} item { title, description, image, excerpt, focusKeyword, bodyText, noindex }
 */
export function auditItem(item = {}) {
  const issues = [];
  const title = firstNonEmpty(item.title);
  const description = firstNonEmpty(item.description);

  const t = scoreTitle(title);
  issues.push({ code: "title", level: t.level, label: t.label });

  const d = scoreDescription(description);
  issues.push({ code: "description", level: d.level, label: d.label });

  issues.push(
    firstNonEmpty(item.excerpt)
      ? { code: "excerpt", level: LEVEL.OK, label: "Con extracto" }
      : { code: "excerpt", level: LEVEL.WARN, label: "Sin extracto" },
  );

  issues.push(
    firstNonEmpty(item.image)
      ? { code: "image", level: LEVEL.OK, label: "Con imagen social" }
      : { code: "image", level: LEVEL.WARN, label: "Sin imagen social" },
  );

  const kw = firstNonEmpty(item.focusKeyword);
  if (!kw) {
    issues.push({ code: "keyword", level: LEVEL.WARN, label: "Sin palabra clave" });
  } else {
    const inTitle = checkKeyword(title, kw);
    const inDesc = checkKeyword(description, kw);
    const inBody = checkKeyword(item.bodyText, kw);
    const hits = [inTitle && "título", inDesc && "meta", inBody && "cuerpo"].filter(Boolean);
    issues.push(
      hits.length >= 2
        ? { code: "keyword", level: LEVEL.OK, label: `Clave en ${hits.join(", ")}` }
        : {
            code: "keyword",
            level: hits.length === 0 ? LEVEL.ERROR : LEVEL.WARN,
            label: hits.length ? `Clave solo en ${hits.join(", ")}` : "Clave ausente del contenido",
          },
    );
  }

  if (item.noindex) {
    issues.push({ code: "noindex", level: LEVEL.WARN, label: "No indexable (noindex)" });
  }

  const errors = issues.filter((i) => i.level === LEVEL.ERROR).length;
  const warnings = issues.filter((i) => i.level === LEVEL.WARN).length;

  return {
    issues,
    errors,
    warnings,
    severity: errors * 10 + warnings, // errores pesan más para el orden "lo peor primero"
    ok: errors === 0 && warnings === 0,
  };
}

export { SITE_URL, siteUrl, LEVEL as SEO_LEVEL };
