"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  calculateProfessionalSettlementItem,
  cents,
  estimateOnvoFeeCents,
} from "@/lib/commission-plan";
import {
  firstIssueMessage,
  settlementInvoiceIdSchema,
  settlementPeriodSchema,
} from "@/lib/financial-schemas";

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

function transactionProcessingFeeCents(transaction) {
  if (transaction.processingFee !== null && transaction.processingFee !== undefined) {
    return cents(transaction.processingFee);
  }
  return estimateOnvoFeeCents(cents(transaction.amount), "card");
}

/**
 * Creates immutable settlement items for one closed period. The cron route and
 * the admin fallback both use this function, so a period has one calculation.
 */
export async function generateSettlementPeriod({ periodStart, periodEnd }) {
  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      status: "APPROVED",
      paidAt: { gte: periodStart, lte: periodEnd },
      settlementItem: null,
    },
    select: {
      id: true,
      professionalId: true,
      amount: true,
      taxRate: true,
      processingFee: true,
      paidAt: true,
      appointment: { select: { id: true, commissionFee: true } },
    },
    orderBy: [{ professionalId: "asc" }, { paidAt: "asc" }, { id: "asc" }],
  });

  const grouped = new Map();
  for (const transaction of transactions) {
    const row = grouped.get(transaction.professionalId) || {
      transactions: [],
      grossCents: 0,
      baseCents: 0,
      commissionCents: 0,
      processingFeeCents: 0,
      netCents: 0,
    };
    row.transactions.push(transaction);
    grouped.set(transaction.professionalId, row);
  }

  let settlementsCreated = 0;
  let itemsCreated = 0;
  for (const [professionalId, group] of grouped) {
    let cumulativeBaseCents = 0;
    const calculatedItems = group.transactions.map((transaction) => {
      const result = calculateProfessionalSettlementItem({
        grossCents: cents(transaction.amount),
        taxRatePct: transaction.taxRate || 4,
        processingFeeCents: transactionProcessingFeeCents(transaction),
        cumulativeBeforeCents: cumulativeBaseCents,
      });
      cumulativeBaseCents = result.cumulativeAfterCents;
      group.grossCents += result.grossCents;
      group.baseCents += result.baseCents;
      group.commissionCents += result.commissionCents;
      group.processingFeeCents += result.processingFeeCents;
      group.netCents += result.professionalInvoiceCents;
      return { transaction, result };
    });

    const effectivePct = group.baseCents > 0
      ? Math.round((group.commissionCents / group.baseCents) * 100)
      : 0;

    await prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.upsert({
        where: {
          professionalId_periodStart_periodEnd: {
            professionalId,
            periodStart,
            periodEnd,
          },
        },
        update: {
          grossAmount: group.grossCents / 100,
          commissionPct: effectivePct,
          commissionAmt: group.commissionCents / 100,
          processingFeeAmt: group.processingFeeCents / 100,
          netAmount: group.netCents / 100,
        },
        create: {
          professionalId,
          periodStart,
          periodEnd,
          grossAmount: group.grossCents / 100,
          commissionPct: effectivePct,
          commissionAmt: group.commissionCents / 100,
          processingFeeAmt: group.processingFeeCents / 100,
          netAmount: group.netCents / 100,
        },
      });

      for (const { transaction, result } of calculatedItems) {
        await tx.appointment.update({
          where: { id: transaction.appointment.id },
          data: { commissionFee: result.commissionCents / 100 },
        });
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: { processingFee: result.processingFeeCents / 100 },
        });
        await tx.settlementItem.create({
          data: {
            settlementId: settlement.id,
            transactionId: transaction.id,
            amount: transaction.amount,
            commissionAmt: result.commissionCents / 100,
            commissionPct: Math.round(result.effectiveRatePct),
            processingFeeAmt: result.processingFeeCents / 100,
            netAmount: result.professionalInvoiceCents / 100,
          },
        }).catch((error) => {
          if (error?.code !== "P2002") throw error;
        });
        itemsCreated += 1;
      }
      settlementsCreated += 1;
    });
  }

  return { success: true, settlementsCreated, items: itemsCreated };
}

export async function generateSettlements(formData) {
  if (!(await requireAdmin())) return { success: false, error: "No autorizado." };
  const parsed = settlementPeriodSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  const result = await generateSettlementPeriod({
    periodStart: atDayBoundary(parsed.data.periodStart),
    periodEnd: atDayBoundary(parsed.data.periodEnd, true),
  });
  revalidatePath("/panel/admin/contabilidad");
  revalidatePath("/panel/profesional/contabilidad");
  return result;
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
