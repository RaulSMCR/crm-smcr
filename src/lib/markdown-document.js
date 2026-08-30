import { extractCrmMetadata } from "@/lib/editorial-metadata";
import { limpiarAndamiajeEditorial } from "@/lib/limpieza-editorial";
import { slugify } from "@/lib/slug";

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
 * Lo que un artículo necesita tener **escrito**, porque no se puede deducir de
 * ninguna otra parte. El orden es el de la lista que ve quien importa.
 *
 * No están acá el `slug` —se deriva del título— ni la fase, la serie y la parte
 * cuando el documento las trae en su línea de cabecera: pedir lo que ya está
 * dicho, aunque esté dicho en prosa, es trabajo inventado.
 *
 * `si` marca los campos que solo hacen falta bajo una condición. El alt es
 * obligatorio, pero de una imagen que existe: reclamarlo cuando todavía no hay
 * portada es mandar a alguien a describir una imagen que nadie eligió.
 */
export const CAMPOS_EDITORIALES = Object.freeze([
  { campo: "excerpt", etiqueta: "resumen (deck)" },
  { campo: "metaTitle", etiqueta: "meta title" },
  { campo: "metaDescription", etiqueta: "meta description" },
  { campo: "focusKeyword", etiqueta: "palabra clave" },
  { campo: "extractiveBlock", etiqueta: "bloque extractivo" },
  { campo: "coverImageAlt", etiqueta: "alt de portada", si: (a) => Boolean(a.coverImage) },
  { campo: "seriesName", etiqueta: "serie" },
  { campo: "seriesOrder", etiqueta: "parte", si: (a) => Boolean(a.seriesName) },
  { campo: "disciplines", etiqueta: "disciplinas" },
  { campo: "topics", etiqueta: "temas" },
]);

/**
 * La línea de cabecera con que la matriz editorial encabeza cada artículo:
 *
 *     **Fase 5 · Artículo 1** · *La angustia y sus formas*
 *     Extensión total: ~4.900 palabras. Corte en 3 partes.
 *
 * Ahí están la fase, el número de entrega y el nombre de la serie, dichos en
 * prosa. Estaban desde siempre y el importador los ignoraba, así que la pantalla
 * los pedía otra vez como si el documento no los tuviera.
 *
 * Solo se leen los primeros renglones del cuerpo, antes del primer separador o
 * encabezado: más adelante el mismo documento dice "Parte 1", "Parte 2" y
 * "Parte 3" para marcar sus cortes internos, que son otra cosa.
 */
export function leerCabeceraEditorial(body) {
  const lineas = [];
  for (const linea of String(body || "").split("\n")) {
    if (/^\s*(?:---+|#{1,6}\s)/.test(linea)) break;
    if (linea.trim()) lineas.push(linea);
    if (lineas.length >= 8) break;
  }

  const cabecera = {};

  for (const linea of lineas) {
    const cortes = linea.match(/corte\s+en\s+(\d+)\s+partes?/i);
    if (cortes && !cabecera.parts) cabecera.parts = cortes[1];

    // Se le quita el marcado y se parte por el separador que usa la matriz.
    const limpia = linea.replace(/[*_`]/g, "").trim();
    if (!/\bfase\b/i.test(limpia)) continue;

    for (const tramo of limpia.split(/\s*[·|]\s*/)) {
      const texto = tramo.trim().replace(/[.,;]+$/, "");
      if (!texto) continue;

      if (/^fase\b/i.test(texto)) {
        cabecera.phase ??= texto;
        continue;
      }
      const entrega = texto.match(/^(?:art[íi]culo|entrega|parte)\s*(\d+)$/i);
      if (entrega) {
        cabecera.part ??= entrega[1];
        continue;
      }
      // Lo que queda al lado de la fase y del número es el nombre de la serie.
      cabecera.series ??= texto;
    }
  }

  return cabecera;
}

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

  // El cuerpo se limpia DESPUÉS de leer la cabecera: primero se aprovecha lo que
  // dice —fase, serie, entrega— y recién entonces se saca del texto publicable.
  const limpieza = limpiarAndamiajeEditorial(heading.body);
  const content = limpieza.contenido;
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

  // La cabecera es el último recurso: si el bloque de metadatos o el front
  // matter dicen la fase, la serie o la parte, mandan ellos. La prosa se lee
  // solo para no volver a pedir lo que el documento ya trae escrito.
  const cabecera = leerCabeceraEditorial(heading.body);

  const crmMetadata = crm.found || Object.keys(frontMatterMetadata).length
    ? { ...(crm.metadata || {}), ...frontMatterMetadata }
    : null;
  const pick = (key) => data[key] || crmMetadata?.[key] || cabecera[key] || null;
  const pickList = (key) => {
    const valor = pick(key);
    if (Array.isArray(valor)) return valor.filter(Boolean);
    return valor ? [valor] : [];
  };
  const partValue = pick("part");

  const parsed = {
    title: title || "",
    content,
    // El slug no se pide: se deriva del título y queda visible en el campo para
    // acortarlo. Al guardar, `updateAdminPost` lo derivaba igual pero sin que
    // nadie lo viera, así que pedirlo en el documento era friccón sin destino.
    slug: pick("slug") || (title ? slugify(title) : null),
    slugDerivado: !pick("slug"),
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
    /// Qué se sacó del cuerpo. La pantalla lo muestra: nada se quita en silencio.
    removidos: limpieza.removidos,
  };

  // Qué le falta al archivo para no nacer en deuda. Se dice al importar y no al
  // publicar: corregirlo en el documento y volver a subirlo cuesta un minuto;
  // descubrirlo tres semanas después, cuando el artículo ya está indexado,
  // cuesta otra cosa.
  parsed.faltantes = CAMPOS_EDITORIALES.filter(({ campo, si }) => {
    if (si && !si(parsed)) return false;
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
