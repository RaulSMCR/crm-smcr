/*
 * Normaliza referencias antiguas de Supabase Storage a `bucket/path`.
 * Por defecto solo muestra los cambios. Usar --apply para escribir en la BD.
 * No mueve ni elimina archivos del Storage.
 */
import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");

const FIELD_MIGRATIONS = [
  ["user", "insuranceBlankFormUrl"],
  ["user", "insurancePatientFormUrl"],
  ["user", "insuranceTemplateUrl"],
  ["insuranceClaim", "signedFormUrl"],
  ["professionalProfile", "cvUrl"],
  ["invoice", "attachmentUrl"],
  ["invoice", "xmlUrl"],
];

function publicStorageReference(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return raw;

  const path = match[2].split(/[?#]/, 1)[0];
  try {
    return `${match[1]}/${decodeURIComponent(path)}`;
  } catch {
    return `${match[1]}/${path}`;
  }
}

function changeFor(value) {
  const next = publicStorageReference(value);
  return next !== value ? next : null;
}

async function updateField(model, field) {
  const rows = await prisma[model].findMany({
    where: { [field]: { not: null } },
    select: { id: true, [field]: true },
  });

  let count = 0;
  for (const row of rows) {
    const next = changeFor(row[field]);
    if (!next) continue;
    count += 1;
    console.log(`${model}.${field} ${row.id}: ${row[field]} -> ${next}`);
    if (APPLY) {
      await prisma[model].update({ where: { id: row.id }, data: { [field]: next } });
    }
  }
  return count;
}

async function recoverInvoiceAttachmentFromNotes() {
  const rows = await prisma.invoice.findMany({
    where: { invoiceType: "SUPPLIER_INVOICE", attachmentUrl: null, notes: { not: null } },
    select: { id: true, notes: true },
  });

  let count = 0;
  for (const row of rows) {
    const match = String(row.notes || "").match(/https?:\/\/[^\s"']+\/storage\/v1\/object\/public\/[^\s"']+/i);
    const next = changeFor(match?.[0]?.replace(/[),.;]+$/, ""));
    if (!next) continue;
    count += 1;
    console.log(`invoice.attachmentUrl ${row.id}: recuperada desde notes -> ${next}`);
    if (APPLY) {
      await prisma.invoice.update({ where: { id: row.id }, data: { attachmentUrl: next } });
    }
  }
  return count;
}

let total = 0;
try {
  for (const [model, field] of FIELD_MIGRATIONS) {
    total += await updateField(model, field);
  }
  total += await recoverInvoiceAttachmentFromNotes();
  console.log(`\n${APPLY ? "Aplicados" : "Detectados"}: ${total} cambios.`);
  if (!APPLY && total > 0) console.log("Ejecuta nuevamente con --apply para escribirlos.");
} finally {
  await prisma.$disconnect();
}
