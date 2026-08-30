// src/lib/editorial-metadata.js
//
// Lee el bloque de metadatos que trae un documento editorial y lo convierte al
// contrato de campos del CRM.
//
// El bloque lo escribe una persona o un GPT editorial, no un programa, así que
// el parser tiene que ser tolerante con la forma y estricto con el destino: se
// aceptan varios nombres para la misma cosa y varias maneras de escribir el
// valor —con negritas, con comillas, en cursiva, en lista o separado por comas—
// pero cada campo cae en una sola columna de la base.
//
// La regla de diseño: **lo que el documento no diga, no se inventa**. Si falta
// la meta description, el campo queda vacío y la deuda editorial la reclama;
// nunca se rellena con las primeras líneas del artículo, porque un resumen
// automático que nadie leyó termina publicado como si lo hubiera escrito
// alguien.

const FIELD_LABELS = new Map([
  // Identidad
  ["titulo", "title"],
  ["title", "title"],
  ["slug", "slug"],
  ["url", "slug"],

  // Resumen visible. "Deck" y "bajada" son como lo llama la prensa, y es lo que
  // devuelven los GPT editoriales cuando no se les da un nombre de campo.
  ["excerpt", "excerpt"],
  ["resumen", "excerpt"],
  ["summary", "excerpt"],
  ["deck", "excerpt"],
  ["bajada", "excerpt"],
  ["entradilla", "excerpt"],
  ["sumario", "excerpt"],

  // SEO
  ["meta title", "metaTitle"],
  ["meta_title", "metaTitle"],
  ["metatitle", "metaTitle"],
  ["titulo seo", "metaTitle"],
  ["titulo alternativo seo", "metaTitle"],
  ["titulo alternativo", "metaTitle"],
  ["seo title", "metaTitle"],
  ["meta description", "metaDescription"],
  ["meta_description", "metaDescription"],
  ["metadescription", "metaDescription"],
  ["descripcion seo", "metaDescription"],
  ["focus keyword", "focusKeyword"],
  ["focus_keyword", "focusKeyword"],
  ["focuskeyword", "focusKeyword"],
  ["palabra clave", "focusKeyword"],
  ["palabra clave principal", "focusKeyword"],
  ["og image", "ogImage"],
  ["og_image", "ogImage"],
  ["ogimage", "ogImage"],
  ["imagen social", "ogImage"],
  ["noindex", "noindex"],
  ["no indexar", "noindex"],
  ["no_indexar", "noindex"],

  // GEO: el párrafo que un modelo puede citar tal cual. No es la meta
  // description —aquella compite por el clic y se corta a 160— sino una
  // respuesta completa y autocontenida.
  ["bloque extractivo", "extractiveBlock"],
  ["extractive block", "extractiveBlock"],
  ["parrafo citable", "extractiveBlock"],
  ["respuesta corta", "extractiveBlock"],

  // Portada y crédito de la obra
  ["portada", "coverImage"],
  ["imagen de portada", "coverImage"],
  ["cover image", "coverImage"],
  ["coverimage", "coverImage"],
  ["alt de portada", "coverImageAlt"],
  ["texto alternativo", "coverImageAlt"],
  ["alt", "coverImageAlt"],
  ["obra", "coverImageTitle"],
  ["titulo de la obra", "coverImageTitle"],
  ["autor de la obra", "coverImageAuthor"],
  ["autoria de la obra", "coverImageAuthor"],
  ["nota de la obra", "coverImageNote"],
  ["credito de la obra", "coverImageNote"],

  // Jerarquía editorial: Fase > Serie > Parte
  ["fase", "phase"],
  ["serie", "series"],
  ["parte", "part"],
  ["partes", "parts"],

  // Taxonomía de biblioteca. El profesional las sugiere y el admin las aprueba,
  // así que importarlas no publica nada: solo evita tipearlas otra vez.
  ["disciplina", "disciplines"],
  ["disciplinas", "disciplines"],
  ["tema", "topics"],
  ["temas", "topics"],
  ["etiquetas", "topics"],
  ["tags", "topics"],

  ["enlaces internos sugeridos", "internalLinks"],
  ["enlaces internos", "internalLinks"],
]);

/**
 * Campos que admiten varios valores. Se pueden escribir en una línea separados
 * por comas o como lista de viñetas debajo de la etiqueta.
 *
 * `internalLinks` es la excepción: sus valores son frases y URLs que llevan
 * comas propias, así que ahí la coma no separa nada.
 */
const LIST_FIELDS = new Set(["disciplines", "topics", "internalLinks"]);
const SPLIT_BY_COMMA = new Set(["disciplines", "topics"]);

/** Encabezados que abren el bloque. Todos los que de hecho aparecen escritos. */
const HEADER_RE =
  /(^|\n)[ \t]*#{1,6}[ \t]*metadatos(?:[ \t]+(?:para[ \t]+)?(?:el[ \t]+)?(?:crm|seo|art[íi]culo|la[ \t]+publicaci[óo]n))?[ \t]*:?[ \t]*(?:\r?\n|$)/i;

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quita el envoltorio con que se escribe un valor: negritas, cursivas, comillas
 * —rectas, tipográficas o angulares— y el punto final que queda colgando cuando
 * la frase iba entre comillas.
 *
 * Se repite hasta que deja de cambiar porque los envoltorios se apilan: lo que
 * devuelve un GPT editorial suele venir en cursiva y entre comillas a la vez.
 */
function cleanValue(value) {
  let out = String(value ?? "").trim();

  // El cierre de la negrita del rótulo queda del lado del valor: en
  // `**Slug:** valor`, lo que sigue a los dos puntos empieza con "** ".
  out = out.replace(/^(?:(?:\*\*|__)\s*)+/, "").trim();

  for (let i = 0; i < 4; i += 1) {
    const antes = out;
    out = out
      .replace(/^(\*\*|__|\*|_|`)([\s\S]*?)\1[ \t]*\.?[ \t]*$/, "$2")
      .replace(/^(["“”'‘’«])([\s\S]*?)(["“”'‘’»])[ \t]*\.?[ \t]*$/, "$2")
      .trim();
    if (out === antes) break;
  }

  // Restos de marcado que quedaron sin cerrar.
  return out
    .replace(/^(?:\*\*|__|`)+/, "")
    .replace(/(?:\*\*|__|`)+$/, "")
    .trim();
}

function parsePartNumber(value) {
  const match = String(value || "").match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function parseBoolean(value) {
  return /^(1|true|yes|si|s[ií])$/i.test(String(value || "").trim());
}

function pushValores(metadata, key, valor) {
  if (!valor) return;
  const partes = SPLIT_BY_COMMA.has(key)
    ? valor.split(/[,;]/).map((parte) => cleanValue(parte)).filter(Boolean)
    : [valor];

  const destino = (metadata[key] ||= []);
  for (const parte of partes) {
    if (!destino.includes(parte)) destino.push(parte);
  }
}

/**
 * Lee el bloque de metadatos y lo separa del contenido publicable.
 *
 * @returns {{found: boolean, content: string, metadata: object|null, raw?: string}}
 */
export function extractCrmMetadata(text) {
  const source = String(text || "");
  const header = HEADER_RE.exec(source);
  if (!header) return { found: false, content: source, metadata: null };

  const blockStart = header.index + header[1].length;
  const block = source.slice(blockStart);
  const lines = block.split(/\r?\n/);
  const metadata = {};
  let currentList = null;

  for (const line of lines.slice(1)) {
    // Otro encabezado cierra el bloque: lo que sigue ya no son metadatos.
    if (/^\s*#{1,6}\s+\S/.test(line)) break;

    const fieldMatch = line.match(
      /^\s*(?:\*\*|__)?\s*([^:*\n]+?)\s*(?:\*\*|__)?\s*:\s*(.*?)\s*$/,
    );

    if (fieldMatch) {
      const key = FIELD_LABELS.get(normalizeLabel(fieldMatch[1]));
      if (!key) {
        currentList = null;
        continue;
      }

      const value = cleanValue(fieldMatch[2]);
      currentList = LIST_FIELDS.has(key) ? key : null;

      if (LIST_FIELDS.has(key)) {
        pushValores(metadata, key, value);
      } else if (key === "noindex") {
        metadata[key] = parseBoolean(value);
      } else if (value) {
        metadata[key] = value;
      }
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/);
    if (listItem && currentList) {
      pushValores(metadata, currentList, cleanValue(listItem[1]));
      continue;
    }

    // Una línea en blanco no cierra la lista —las viñetas suelen ir separadas—
    // pero un párrafo suelto sí: ya no pertenece al campo anterior.
    if (line.trim()) currentList = null;
  }

  for (const key of LIST_FIELDS) {
    if (metadata[key] && !metadata[key].length) delete metadata[key];
  }
  if (metadata.part) metadata.partNumber = parsePartNumber(metadata.part);
  if (metadata.parts) metadata.partsCount = parsePartNumber(metadata.parts);

  const content = source.slice(0, blockStart).replace(/[\r\n\s]+$/, "");
  return {
    found: true,
    content,
    metadata,
    raw: source.slice(blockStart),
  };
}
