const FIELD_LABELS = new Map([
  ["slug", "slug"],
  ["meta title", "metaTitle"],
  ["meta description", "metaDescription"],
  ["focus keyword", "focusKeyword"],
  ["fase", "phase"],
  ["serie", "series"],
  ["parte", "part"],
  ["partes", "parts"],
  ["enlaces internos sugeridos", "internalLinks"],
]);

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanValue(value) {
  return String(value || "")
    .replace(/^\s*(?:(?:\*\*|__)\s*)+/, "")
    .replace(/^`/, "")
    .replace(/[`*_]+\s*$/, "")
    .trim();
}

function parsePartNumber(value) {
  const match = String(value || "").match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Lee el bloque que suelen devolver los GPT editoriales y lo convierte al
 * contrato de campos que ya usa el CRM. No depende de Prisma ni del navegador.
 */
export function extractCrmMetadata(text) {
  const source = String(text || "");
  const header = /(^|\n)\s*#{1,6}\s*metadatos\s+para\s+crm\s*\n/i.exec(source);
  if (!header) return { found: false, content: source, metadata: null };

  const blockStart = header.index + header[1].length;
  const block = source.slice(blockStart);
  const lines = block.split(/\r?\n/);
  const metadata = { internalLinks: [] };
  let currentList = null;

  for (const line of lines.slice(1)) {
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
      currentList = key === "internalLinks" ? "internalLinks" : null;
      if (key === "internalLinks") {
        if (value) metadata.internalLinks.push(value);
      } else if (value) {
        metadata[key] = value;
      }
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/);
    if (listItem && currentList === "internalLinks") {
      metadata.internalLinks.push(cleanValue(listItem[1]));
    }
  }

  if (!metadata.internalLinks.length) delete metadata.internalLinks;
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
