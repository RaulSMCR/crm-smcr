"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  firstIssueMessage,
  settlementInvoiceIdSchema,
  settlementPeriodSchema,
} from "@/lib/financial-schemas";

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function atDayBoundary(date, end = false) {
  const bounded = new Date(date);
  if (end) bounded.setHours(23, 59, 59, 999);
  else bounded.setHours(0, 0, 0, 0);
  return bounded;
}

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "ADMIN" ? session : null;
}

export async function generateSettlements(formData) {
  if (!(await requireAdmin())) return { success: false, error: "No autorizado." };
  const parsed = settlementPeriodSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  const start = atDayBoundary(parsed.data.periodStart);
  const end = atDayBoundary(parsed.data.periodEnd, true);

  const transactions = await prisma.paymentTransaction.findMany({
    where: { status: "APPROVED", paidAt: { gte: start, lte: end }, settlementItem: null },
    select: { id: true, professionalId: true, amount: true, appointment: { select: { commissionFee: true } } },
    orderBy: { paidAt: "asc" },
  });
  const grouped = new Map();
  for (const transaction of transactions) {
    const row = grouped.get(transaction.professionalId) || { transactions: [], gross: 0, commission: 0 };
    const amountCents = cents(transaction.amount);
    const commissionCents = cents(transaction.appointment?.commissionFee);
    row.transactions.push(transaction);
    row.gross += amountCents;
    row.commission += commissionCents;
    grouped.set(transaction.professionalId, row);
  }

  let created = 0;
  for (const [professionalId, group] of grouped) {
    const professional = await prisma.professionalProfile.findUnique({ where: { id: professionalId }, select: { commission: true } });
    const pct = Number(professional?.commission || 0);
    await prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.upsert({
        where: { professionalId_periodStart_periodEnd: { professionalId, periodStart: start, periodEnd: end } },
        update: {},
        create: {
          professionalId,
          periodStart: start,
          periodEnd: end,
          grossAmount: group.gross / 100,
          commissionPct: pct,
          commissionAmt: group.commission / 100,
          netAmount: (group.gross - group.commission) / 100,
        },
      });
      for (const transaction of group.transactions) {
        await tx.settlementItem.create({
          data: {
            settlementId: settlement.id,
            transactionId: transaction.id,
            amount: transaction.amount,
            commissionAmt: transaction.appointment?.commissionFee || 0,
          },
        }).catch((error) => {
          if (error?.code !== "P2002") throw error;
        });
      }
      created += 1;
    });
  }
  revalidatePath("/panel/admin/contabilidad");
  revalidatePath("/panel/profesional/contabilidad");
  return { success: true, settlementsCreated: created, items: transactions.length };
}

export async function markSettlementPaid(invoiceId) {
  if (!(await requireAdmin())) return { success: false, error: "No autorizado." };
  const parsed = settlementInvoiceIdSchema.safeParse({ invoiceId });
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  const { invoiceId: id } = parsed.data;
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true } });
  if (!invoice || invoice.status !== "PAID") return { success: false, error: "La factura aún no está pagada." };
  await prisma.settlement.updateMany({ where: { invoiceId: id, status: "INVOICED" }, data: { status: "PAID" } });
  revalidatePath("/panel/admin/contabilidad");
  return { success: true };
}
