"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function admin() {
  const session = await getSession();
  return session?.role === "ADMIN";
}

function bounds(year, month) {
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 1);
  return { start, end };
}

export async function closeFiscalPeriod(formData) {
  if (!(await admin())) return { success: false, error: "No autorizado." };
  const year = formData.get("year");
  const month = formData.get("month");
  const withholdings = formData.get("withholdings") || 0;
  const { start, end } = bounds(year, month);
  const [sales, salesCredits, purchases, purchaseCredits] = await Promise.all([
    prisma.invoice.aggregate({ where: { invoiceType: "CUSTOMER_INVOICE", invoiceDate: { gte: start, lt: end }, feStatus: "ACCEPTED" }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "CUSTOMER_CREDIT_NOTE", invoiceDate: { gte: start, lt: end } }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "SUPPLIER_INVOICE", invoiceDate: { gte: start, lt: end }, acceptanceStatus: "ACCEPTED" }, _sum: { taxAmount: true, subtotal: true, total: true } }),
    prisma.invoice.aggregate({ where: { invoiceType: "SUPPLIER_CREDIT_NOTE", invoiceDate: { gte: start, lt: end }, acceptanceStatus: "ACCEPTED" }, _sum: { taxAmount: true, subtotal: true, total: true } }),
  ]);
  const value = (x) => Number(x || 0);
  const ivaDebito = value(sales._sum.taxAmount) - value(salesCredits._sum.taxAmount);
  const ivaCredito = value(purchases._sum.taxAmount) - value(purchaseCredits._sum.taxAmount);
  const ivaNeto = ivaDebito - ivaCredito - Number(withholdings || 0);
  const snapshot = { year: Number(year), month: Number(month), sales, salesCredits, purchases, purchaseCredits, ivaDebito, ivaCredito, ivaNeto };
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
