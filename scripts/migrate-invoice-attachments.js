import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const invoices = await prisma.invoice.findMany({
  where: { invoiceType: "SUPPLIER_INVOICE", attachmentUrl: null, notes: { not: null } },
  select: { id: true, notes: true },
});

for (const invoice of invoices) {
  const match = String(invoice.notes || "").match(/https?:\/\/\S+\.(?:pdf)(?:\?\S*)?/i);
  if (match) await prisma.invoice.update({ where: { id: invoice.id }, data: { attachmentUrl: match[0] } });
}
await prisma.$disconnect();
