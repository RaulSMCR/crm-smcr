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
 *            ogImage: string|null, noindex: boolean, phase: string|null,
 *            seriesName: string|null, seriesOrder: number|null,
 *            crmMetadata: object|null, warnings: string[] }}
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
  ]) {
    if (data[key] !== undefined) frontMatterMetadata[key] = data[key];
  }

  const crmMetadata = crm.found || Object.keys(frontMatterMetadata).length
    ? { ...(crm.metadata || {}), ...frontMatterMetadata }
    : null;
  const pick = (key) => data[key] || crmMetadata?.[key] || null;
  const partValue = pick("part");

  return {
    title: title || "",
    content,
    slug: pick("slug"),
    excerpt: pick("excerpt"),
    metaTitle: pick("metaTitle"),
    metaDescription: pick("metaDescription"),
    focusKeyword: pick("focusKeyword"),
    ogImage: pick("ogImage"),
    noindex: data.noindex ?? Boolean(crmMetadata?.noindex),
    phase: pick("phase"),
    seriesName: pick("series"),
    seriesOrder: parsePartNumber(partValue),
    crmMetadata,
    warnings,
  };
}
