import { extractCrmMetadata } from "@/lib/editorial-metadata";

/**
 * Lee un archivo .md tal como sale de un editor externo (Obsidian, Typora, un
 * GPT editorial, un export de Google Docs) y lo convierte al contrato de campos
 * del CRM. No depende de Prisma ni del navegador: se puede testear en Node.
 *
 * Reconoce tres fuentes de metadatos, en orden de prioridad:
 *  1. Front matter YAML sencillo (`---` … `---`) al inicio del archivo.
 *  2. El bloque "Metadatos para CRM" que ya entiende editorial-metadata.js.
 *  3. El primer título `# H1` del cuerpo, que pasa a ser el título del artículo.
 */

const FRONT_MATTER_KEYS = new Map([
  ["title", "title"],
  ["titulo", "title"],
  ["slug", "slug"],
  ["url", "slug"],
  ["excerpt", "excerpt"],
  ["resumen", "excerpt"],
  ["summary", "excerpt"],
  ["metatitle", "metaTitle"],
  ["meta title", "metaTitle"],
  ["meta_title", "metaTitle"],
  ["metadescription", "metaDescription"],
  ["meta description", "metaDescription"],
  ["meta_description", "metaDescription"],
  ["description", "metaDescription"],
  ["descripcion", "metaDescription"],
  ["focuskeyword", "focusKeyword"],
  ["focus keyword", "focusKeyword"],
  ["focus_keyword", "focusKeyword"],
  ["keyword", "focusKeyword"],
  ["palabra clave", "focusKeyword"],
  ["palabra_clave", "focusKeyword"],
  ["ogimage", "ogImage"],
  ["og image", "ogImage"],
  ["og_image", "ogImage"],
  ["imagen social", "ogImage"],
  ["imagen_social", "ogImage"],
  ["noindex", "noindex"],
  ["no indexar", "noindex"],
  ["no_indexar", "noindex"],
  ["fase", "phase"],
  ["phase", "phase"],
  ["serie", "series"],
  ["series", "series"],
  ["parte", "part"],
  ["part", "part"],
  ["series_order", "part"],
  ["series order", "part"],
  ["partes", "parts"],
  ["parts", "parts"],
  ["bloque extractivo", "extractiveBlock"],
  ["bloque_extractivo", "extractiveBlock"],
  ["extractiveblock", "extractiveBlock"],
  ["portada", "coverImage"],
  ["coverimage", "coverImage"],
  ["cover_image", "coverImage"],
  ["alt", "coverImageAlt"],
  ["alt de portada", "coverImageAlt"],
  ["coverimagealt", "coverImageAlt"],
  ["obra", "coverImageTitle"],
  ["coverimagetitle", "coverImageTitle"],
  ["autor de la obra", "coverImageAuthor"],
  ["coverimageauthor", "coverImageAuthor"],
  ["nota de la obra", "coverImageNote"],
  ["coverimagenote", "coverImageNote"],
  // Listas: en front matter se escriben en una línea, separadas por comas.
  ["disciplina", "disciplines"],
  ["disciplinas", "disciplines"],
  ["disciplines", "disciplines"],
  ["tema", "topics"],
  ["temas", "topics"],
  ["topics", "topics"],
  ["tags", "topics"],
]);

/** Campos del front matter que se leen como lista separada por comas. */
const FRONT_MATTER_LISTS = new Set(["disciplines", "topics"]);

/**
 * Lo que un artículo necesita tener cargado para no quedar en deuda editorial.
 * El orden es el de la lista que se le muestra a quien importa el archivo.
 * Coincide a propósito con lo que reclama `deuda-editorial.js`: si algo se
 * exige allá y no se pide acá, el archivo pasa y la deuda aparece después.
 */
export const CAMPOS_EDITORIALES = Object.freeze([
  { campo: "slug", etiqueta: "slug" },
  { campo: "excerpt", etiqueta: "resumen (deck)" },
  { campo: "metaTitle", etiqueta: "meta title" },
  { campo: "metaDescription", etiqueta: "meta description" },
  { campo: "focusKeyword", etiqueta: "palabra clave" },
  { campo: "extractiveBlock", etiqueta: "bloque extractivo" },
  { campo: "coverImageAlt", etiqueta: "alt de portada" },
  { campo: "seriesName", etiqueta: "serie" },
  { campo: "seriesOrder", etiqueta: "parte" },
  { campo: "disciplines", etiqueta: "disciplinas" },
  { campo: "topics", etiqueta: "temas" },
]);

const TEXT_EXTENSIONS = [".md", ".markdown", ".mdown", ".mdx", ".txt"];

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanScalar(value) {
  const raw = String(value ?? "").trim();
  const unquoted = raw.replace(/^(['"])([\s\S]*)\1$/, "$2");
  return unquoted.trim();
}

function parseBoolean(value) {
  return /^(1|true|yes|si|s[ií])$/i.test(String(value || "").trim());
}

function parsePartNumber(value) {
  const match = String(value || "").match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

/** Front matter YAML plano: solo `clave: valor` de una línea. Listas y objetos se ignoran. */
function parseFrontMatter(source) {
  const match = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) return { data: {}, body: source };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const pair = line.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_ -]+?)\s*:\s*([\s\S]*)$/);
    if (!pair) continue;

    const key = FRONT_MATTER_KEYS.get(normalizeKey(pair[1]));
    if (!key) continue;

    const value = cleanScalar(pair[2]);
    if (!value) continue;

    if (FRONT_MATTER_LISTS.has(key)) {
      // Se admite `temas: angustia, ansiedad` y también la forma de lista de
      // YAML escrita en una línea: `temas: [angustia, ansiedad]`.
      data[key] = value
        .replace(/^\[|\]$/g, "")
        .split(/[,;]/)
        .map((parte) => cleanScalar(parte))
        .filter(Boolean);
      continue;
    }

    data[key] = key === "noindex" ? parseBoolean(value) : value;
  }

  return { data, body: source.slice(match[0].length) };
}

/** Saca el primer `# H1` del cuerpo y lo devuelve como título. */
function extractLeadingHeading(body) {
  const match = /^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/.exec(body);
  if (!match) return { title: null, body };
  return {
    title: cleanScalar(match[1].replace(/\s*#+\s*$/, "")),
    body: body.slice(match[0].length).replace(/^\s*\r?\n/, ""),
  };
}

function titleFromFileName(fileName) {
  const base = String(fileName || "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function isMarkdownFileName(fileName) {
  const name = String(fileName || "").toLowerCase();
  return TEXT_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/**
 * @param {string} text  contenido crudo del archivo
 * @param {string} [fileName]  nombre del archivo, usado solo como último recurso para el título
 * @returns {{ title: string, content: string, slug: string|null, excerpt: string|null,
 *            metaTitle: string|null, metaDescription: string|null, focusKeyword: string|null,
 *            ogImage: string|null, noindex: boolean, extractiveBlock: string|null,
 *            coverImage: string|null, coverImageAlt: string|null,
 *            coverImageTitle: string|null, coverImageAuthor: string|null,
 *            coverImageNote: string|null, phase: string|null,
 *            seriesName: string|null, seriesOrder: number|null,
 *            disciplines: string[], topics: string[],
 *            crmMetadata: object|null, warnings: string[], faltantes: string[] }}
 */
export function parseMarkdownDocument(text, fileName = "") {
  const source = String(text || "")
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n");

  const { data, body } = parseFrontMatter(source);

  // El bloque "Metadatos para CRM" va al final del documento: se extrae antes de
  // buscar el H1 para que no quede pegado al contenido publicable.
  const crm = extractCrmMetadata(body);
  const withoutCrm = crm.found ? crm.content : body;

  const heading = extractLeadingHeading(withoutCrm);

  const warnings = [];
  const title = data.title || heading.title || titleFromFileName(fileName);
  if (!title) warnings.push("El archivo no tiene título; escribilo a mano antes de guardar.");

  const content = heading.body.trim();
  if (!content) warnings.push("El archivo no tiene contenido después del título.");

  const frontMatterMetadata = {};
  for (const key of [
    "slug",
    "excerpt",
    "metaTitle",
    "metaDescription",
    "focusKeyword",
    "ogImage",
    "noindex",
    "phase",
    "series",
    "part",
    "parts",
    "extractiveBlock",
    "coverImage",
    "coverImageAlt",
    "coverImageTitle",
    "coverImageAuthor",
    "coverImageNote",
    "disciplines",
    "topics",
  ]) {
    if (data[key] !== undefined) frontMatterMetadata[key] = data[key];
  }

  const crmMetadata = crm.found || Object.keys(frontMatterMetadata).length
    ? { ...(crm.metadata || {}), ...frontMatterMetadata }
    : null;
  const pick = (key) => data[key] || crmMetadata?.[key] || null;
  const pickList = (key) => {
    const valor = pick(key);
    if (Array.isArray(valor)) return valor.filter(Boolean);
    return valor ? [valor] : [];
  };
  const partValue = pick("part");

  const parsed = {
    title: title || "",
    content,
    slug: pick("slug"),
    excerpt: pick("excerpt"),
    metaTitle: pick("metaTitle"),
    metaDescription: pick("metaDescription"),
    focusKeyword: pick("focusKeyword"),
    ogImage: pick("ogImage"),
    noindex: data.noindex ?? Boolean(crmMetadata?.noindex),
    extractiveBlock: pick("extractiveBlock"),
    coverImage: pick("coverImage"),
    coverImageAlt: pick("coverImageAlt"),
    coverImageTitle: pick("coverImageTitle"),
    coverImageAuthor: pick("coverImageAuthor"),
    coverImageNote: pick("coverImageNote"),
    phase: pick("phase"),
    seriesName: pick("series"),
    seriesOrder: parsePartNumber(partValue),
    disciplines: pickList("disciplines"),
    topics: pickList("topics"),
    crmMetadata,
    warnings,
  };

  // Qué le falta al archivo para no nacer en deuda. Se dice al importar y no al
  // publicar: corregirlo en el documento y volver a subirlo cuesta un minuto;
  // descubrirlo tres semanas después, cuando el artículo ya está indexado,
  // cuesta otra cosa.
  parsed.faltantes = CAMPOS_EDITORIALES.filter(({ campo }) => {
    const valor = parsed[campo];
    return Array.isArray(valor) ? valor.length === 0 : !valor;
  }).map(({ etiqueta }) => etiqueta);

  if (!crm.found && !Object.keys(frontMatterMetadata).length) {
    warnings.push(
      'El archivo no trae bloque de metadatos. Agregale un "## Metadatos para CRM" al final o un front matter YAML al inicio.',
    );
  }

  return parsed;
}
