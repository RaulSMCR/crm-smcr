/* Convierte referencias públicas antiguas a `bucket/path`. Ejecutar una vez con DATABASE_URL configurada. */
import { prisma } from "../src/lib/prisma.js";

const fields = [
  ["user", "insuranceBlankFormUrl"], ["user", "insurancePatientFormUrl"], ["user", "insuranceTemplateUrl"],
  ["insuranceClaim", "signedFormUrl"], ["professionalProfile", "cvUrl"],
];

function extract(value) {
  const match = String(value || "").match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  return match ? `${match[1]}/${decodeURIComponent(match[2])}` : value;
}

for (const [model, field] of fields) {
  const rows = await prisma[model].findMany({ where: { [field]: { not: null } }, select: { id: true, [field]: true } });
  for (const row of rows) {
    const next = extract(row[field]);
    if (next !== row[field]) await prisma[model].update({ where: { id: row.id }, data: { [field]: next } });
  }
}
await prisma.$disconnect();

