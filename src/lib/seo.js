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

const SITE_NAME = "Salud Mental Costa Rica";

/**
 * Imagen social por defecto: se genera en `/og` con el título de la página.
 *
 * Antes esto era la constante `"/og-image.png"`, un archivo que no existía en
 * `public/` ni en producción. El efecto: `og:image` y `twitter:image` apuntaban
 * a un 404 y toda página compartida en WhatsApp, Instagram, Facebook o LinkedIn
 * salía con la vista previa rota.
 *
 * Se genera por página en vez de servir un PNG fijo porque la tarjeta es donde
 * se decide si alguien abre el enlace, y quince artículos compartidos con la
 * misma estampa desperdician ese espacio.
 */
export function defaultOgImage(title, subtitle) {
  const params = new URLSearchParams();
  if (title) params.set("t", String(title));
  if (subtitle) params.set("s", String(subtitle));
  const qs = params.toString();
  return siteUrl(qs ? `og?${qs}` : "og");
}

/**
 * Recorta a un largo máximo respetando palabras.
 *
 * El corte por espacio no alcanza: once excerpts terminaban en coma o punto y
 * coma —"…se reconozca primero como carente," — porque la palabra anterior al
 * corte traía puntuación pegada. Una descripción que termina en coma se lee como
 * un error, no como un resumen.
 *
 * Así que después de cortar se limpia la puntuación colgante y se cierra con
 * puntos suspensivos, que es lo que dice "esto sigue" sin fingir que la frase
 * terminó ahí.
 */
function clampText(str, max) {
  const value = String(str || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;

  // Se reserva lugar para el carácter de elipsis, o el resultado se pasa de max.
  const limite = Math.max(1, max - 1);
  const cut = value.slice(0, limite);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > limite * 0.6 ? cut.slice(0, lastSpace) : cut;

  // Fuera espacios y puntuación de cierre pegada al corte: , ; : . · - — etc.
  const limpio = base.replace(/[\s.,;:·—–-]+$/u, "");
  if (!limpio) return base.trim();

  return `${limpio}…`;
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
 * @param {object} fallbacks  { title, description, image, imageAlt, subtitle }
 */
export function resolveSeo(entity = {}, fallbacks = {}) {
  const title = firstNonEmpty(entity.metaTitle, fallbacks.title);
  const description = clampText(
    firstNonEmpty(entity.metaDescription, fallbacks.description),
    SEO_LIMITS.description.max,
  );

  // `imagenPropia` distingue «tiene una imagen editorial de verdad» de «le
  // generamos una». Sin esa distinción, el panel de SEO —que audita esta misma
  // salida— dejaría de avisar «sin imagen social» para siempre, porque desde que
  // /og genera una por defecto el campo nunca vuelve a quedar vacío.
  const imagenPropia = firstNonEmpty(entity.ogImage, fallbacks.image);
  const image = imagenPropia || defaultOgImage(title, fallbacks.subtitle);
  const imageAlt = firstNonEmpty(fallbacks.imageAlt, title, SITE_NAME);

  return {
    title,
    description,
    image,
    imageAlt,
    imagenPropia: Boolean(imagenPropia),
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
/**
 * Título para Open Graph, con la marca al final.
 *
 * No la anexa si el título ya la trae: el de la home empieza con «Salud Mental
 * Costa Rica», y concatenar a ciegas producía «Salud Mental Costa Rica —
 * Bienestar con profesionales validados | Salud Mental Costa Rica» en la
 * previsualización de WhatsApp y LinkedIn, justo en la página que más se
 * comparte. La comparación ignora mayúsculas y acentos porque un título
 * editorial puede escribir la marca de otra forma.
 */
function ogTitle(title) {
  if (!title) return SITE_NAME;

  const normalizar = (texto) =>
    String(texto)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

  return normalizar(title).includes(normalizar(SITE_NAME))
    ? title
    : `${title} | ${SITE_NAME}`;
}

export function buildMetadata({
  title,
  description,
  path = "",
  image,
  imageAlt,
  subtitle,
  type = "website",
  noindex = false,
  keywords,
} = {}) {
  const canonical = siteUrl(path);
  const ogImage = image || defaultOgImage(title, subtitle);
  const cleanDescription = clampText(description, SEO_LIMITS.description.max);
  const ogImages = [{ url: ogImage, width: 1200, height: 630, alt: imageAlt || title || SITE_NAME }];

  const metadata = {
    title,
    description: cleanDescription,
    alternates: { canonical },
    openGraph: {
      title: ogTitle(title),
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

  // `imagenPropia` viene de resolveSeo y dice si hay una imagen editorial. Se
  // consulta antes que `image` porque desde que /og genera una tarjeta por
  // defecto, `image` nunca está vacío y este aviso no volvería a dispararse.
  const conImagen = item.imagenPropia ?? Boolean(firstNonEmpty(item.image));
  issues.push(
    conImagen
      ? { code: "image", level: LEVEL.OK, label: "Con imagen social" }
      : { code: "image", level: LEVEL.WARN, label: "Portada propia ausente (se genera una)" },
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
