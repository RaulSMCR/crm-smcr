"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { COMPROBANTE_DE_VENTA_DECLARADO, limitesMesCr } from "@/lib/fiscal-periodo";

async function admin() {
  const session = await getSession();
  return session?.role === "ADMIN";
}

export async function closeFiscalPeriod(formData) {
  if (!(await admin())) return { success: false, error: "No autorizado." };
  const year = formData.get("year");
  const month = formData.get("month");
  const withholdings = formData.get("withholdings") || 0;
  // Mes calendario de Costa Rica, no del servidor (Vercel corre en UTC).
  let start, end;
  try { ({ start, end } = limitesMesCr(year, month)); }
  catch { return { success: false, error: "Período inválido." }; }
  // Lo presentado no se recalcula en silencio: los números congelados son los
  // que se declararon. Corregir un mes presentado es una rectificativa.
  const existente = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year: Number(year), month: Number(month) } }, select: { status: true } });
  if (existente?.status === "FILED") return { success: false, error: "Ese período ya se marcó como presentado; no se vuelve a cerrar." };
  const [sales, salesCredits, purchases, purchaseCredits] = await Promise.all([
    prisma.invoice.aggregate({ where: { invoiceType: "CUSTOMER_INVOICE", invoiceDate: { gte: start, lt: end }, ...COMPROBANTE_DE_VENTA_DECLARADO }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "CUSTOMER_CREDIT_NOTE", invoiceDate: { gte: start, lt: end }, ...COMPROBANTE_DE_VENTA_DECLARADO }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "SUPPLIER_INVOICE", invoiceDate: { gte: start, lt: end }, acceptanceStatus: "ACCEPTED" }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "SUPPLIER_CREDIT_NOTE", invoiceDate: { gte: start, lt: end }, acceptanceStatus: "ACCEPTED" }, _sum: { taxAmount: true, subtotal: true, total: true } }),
  ]);
  const value = (x) => Number(x || 0);
  // Solo notas aceptadas y no canceladas, restadas por su valor absoluto: se
  // guardan en negativo, y restar el negativo SUMABA IVA en vez de bajarlo.
  const ivaDebito = value(sales._sum.taxAmount) - Math.abs(value(salesCredits._sum.taxAmount));
  const ivaCredito = value(purchases._sum.taxAmount) - Math.abs(value(purchaseCredits._sum.taxAmount));
  const ivaNeto = ivaDebito - ivaCredito - Number(withholdings || 0);
  // Bases netas de notas de crédito, igual que el IVA: antes el export ponía la
  // base bruta junto a la cuota neta (noviembre 2026: ₡1.033.653,85 en vez de
  // ₡620.192,31, porque la 0221 anulada por la 0100 seguía en la base).
  const baseVentas = value(sales._sum.subtotal) - Math.abs(value(salesCredits._sum.subtotal));
  const baseCompras = value(purchases._sum.subtotal) - Math.abs(value(purchaseCredits._sum.subtotal));
  const snapshot = { year: Number(year), month: Number(month), sales, salesCredits, purchases, purchaseCredits, baseVentas, baseCompras, ivaDebito, ivaCredito, ivaNeto };
  const period = await prisma.fiscalPeriod.upsert({
    where: { year_month: { year: Number(year), month: Number(month) } },
    update: { ivaDebito, ivaCredito, ivaNeto, withholdings: Number(withholdings || 0), snapshot, status: "CLOSED" },
    create: { year: Number(year), month: Number(month), ivaDebito, ivaCredito, ivaNeto, withholdings: Number(withholdings || 0), snapshot, status: "CLOSED" },
  });
  revalidatePath("/panel/admin/contabilidad/cierre-fiscal");
  return { success: true, period };
}

export async function fileFiscalPeriod(formData) {
  if (!(await admin())) return { success: false, error: "No autorizado." };
  const year = formData.get("year");
  const month = formData.get("month");
  const filedReceipt = formData.get("filedReceipt");
  const receipt = String(filedReceipt || "").trim();
  if (!receipt) return { success: false, error: "El comprobante es obligatorio." };
  await prisma.fiscalPeriod.update({ where: { year_month: { year: Number(year), month: Number(month) } }, data: { status: "FILED", filedAt: new Date(), filedReceipt: receipt } });
  revalidatePath("/panel/admin/contabilidad/cierre-fiscal");
  return { success: true };
}
