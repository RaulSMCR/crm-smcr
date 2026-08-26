"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  COMMISSION_PLAN_VERSION,
  buildConsultationNumberMap,
  calculateProfessionalSettlementItem,
  cents,
  estimateOnvoFee,
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

/**
 * Costo de procesamiento que se le traslada al profesional por esta transacción.
 *
 * ONVO cobra un fijo en dólares POR TRANSACCIÓN, así que cobrar la primera
 * consulta en dos tractos —adelanto y saldo— lo paga dos veces. **Ese segundo
 * fijo lo asume la plataforma, no el profesional** (decisión de Raúl,
 * 2026-08-26): partir el cobro en dos es una medida de la plataforma para
 * asegurar la reserva, y no sería justo cobrarle a él el costo de una decisión
 * que no tomó. El porcentaje sí se traslada completo en ambos tramos, porque es
 * proporcional al dinero efectivamente movido.
 *
 * Ver la cláusula 6.2 del anexo económico.
 */
function transactionProcessingFeeCents(transaction) {
  const esSegundoTramo = transaction.type === "BALANCE_50";

  if (transaction.processingFee !== null && transaction.processingFee !== undefined) {
    const registrado = cents(transaction.processingFee);
    if (!esSegundoTramo) return registrado;
    // Del costo real registrado se descuenta el fijo, que corre por cuenta de la
    // plataforma en este tramo. Nunca baja de cero.
    const fijo = estimateOnvoFee(cents(transaction.amount), "card").fixedCents;
    return Math.max(0, registrado - fijo);
  }

  const estimado = estimateOnvoFee(cents(transaction.amount), "card");
  return esSegundoTramo ? estimado.percentCents : estimado.totalCents;
}

/**
 * Creates immutable settlement items for one closed period. The cron route and
 * the admin fallback both use this function, so a period has one calculation.
 */
export async function generateSettlementPeriod({ periodStart, periodEnd }) {
  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      status: "APPROVED",
      settlementItem: null,
      OR: [
        // Consulta prestada y cobrada.
        {
          appointment: { status: "COMPLETED" },
          type: { in: ["BALANCE_50", "FULL_100"] },
          paidAt: { gte: periodStart, lte: periodEnd },
        },
        // El adelanto viaja con su saldo: el 50% inicial no se liquida solo,
        // porque hasta que no se paga el saldo no hubo consulta que cobrar.
        {
          type: "DEPOSIT_50",
          appointment: {
            status: "COMPLETED",
            paymentTransactions: {
              some: {
                type: "BALANCE_50",
                status: "APPROVED",
                paidAt: { gte: periodStart, lte: periodEnd },
              },
            },
          },
        },
        // Multa por cancelar con menos de 24 horas o no asistir. Se liquida
        // igual que un cobro normal: el horario se apartó y no pudo ofrecerse a
        // nadie más, así que el profesional percibe su parte. A propósito NO se
        // exige `appointment.status = COMPLETED`: una cita cancelada nunca
        // llega a ese estado, y exigirlo era lo que dejaba estos cobros fuera de
        // toda liquidación, con el 100% de la multa quedándose en la plataforma.
        {
          type: "PENALTY_50",
          paidAt: { gte: periodStart, lte: periodEnd },
        },
      ],
    },
    select: {
      id: true,
      professionalId: true,
      patientId: true,
      type: true,
      amount: true,
      taxRate: true,
      processingFee: true,
      paidAt: true,
      appointment: {
        select: {
          id: true,
          date: true,
          patientId: true,
          professionalId: true,
          isFirstWithProfessional: true,
        },
      },
    },
    orderBy: [{ professionalId: "asc" }, { paidAt: "asc" }, { id: "asc" }],
  });

  if (transactions.length === 0) {
    return { success: true, settlementsCreated: 0, items: 0 };
  }

  const relationshipFilters = Array.from(
    new Map(
      transactions.map((transaction) => [
        `${transaction.patientId}:${transaction.professionalId}`,
        {
          patientId: transaction.patientId,
          professionalId: transaction.professionalId,
        },
      ])
    ).values()
  );
  // Qué citas ocupan una posición en la secuencia: las que se cobraron, no las
  // que se prestaron. Una consulta realizada y pagada cuenta, y una cancelada
  // fuera de tiempo cuya multa el paciente pagó también, porque se facturó. Una
  // cita cancelada que nadie pagó no entra: su posición queda libre para la
  // siguiente.
  const chargedAppointments = await prisma.appointment.findMany({
    where: {
      OR: relationshipFilters,
      AND: {
        OR: [
          { status: "COMPLETED" },
          {
            paymentTransactions: {
              some: { type: "PENALTY_50", status: "APPROVED" },
            },
          },
        ],
      },
    },
    select: {
      id: true,
      patientId: true,
      professionalId: true,
      date: true,
    },
  });

  // Los números ya emitidos en liquidaciones anteriores son intocables: una
  // liquidación cerrada no se renumera. Un pago que llega tarde toma la
  // siguiente posición libre en vez de correr a las que ya se facturaron.
  const itemsPrevios = await prisma.settlementItem.findMany({
    where: {
      consultationNumber: { not: null },
      transaction: { appointmentId: { in: chargedAppointments.map((a) => a.id) } },
    },
    select: { consultationNumber: true, transaction: { select: { appointmentId: true } } },
  });
  const numerosAsignados = new Map(
    itemsPrevios
      .filter((item) => item.transaction?.appointmentId)
      .map((item) => [item.transaction.appointmentId, item.consultationNumber]),
  );

  const consultationNumbers = buildConsultationNumberMap(chargedAppointments, { numerosAsignados });

  const grouped = new Map();
  for (const transaction of transactions) {
    const row = grouped.get(transaction.professionalId) || {
      transactions: [],
      grossCents: 0,
      baseCents: 0,
      commissionCents: 0,
      processingFeeCents: 0,
      netCents: 0,
      taxRates: new Set(),
    };
    row.transactions.push(transaction);
    grouped.set(transaction.professionalId, row);
  }

  let settlementsCreated = 0;
  let itemsCreated = 0;
  for (const [professionalId, group] of grouped) {
    const calculatedItems = group.transactions.map((transaction) => {
      const consultationNumber = consultationNumbers.get(transaction.appointment.id);
      if (!consultationNumber) {
        throw new Error(
          `No se pudo determinar la secuencia de la cita ${transaction.appointment.id}.`
        );
      }
      const taxRatePct = transaction.taxRate || 4;
      const result = calculateProfessionalSettlementItem({
        grossCents: cents(transaction.amount),
        taxRatePct,
        processingFeeCents: transactionProcessingFeeCents(transaction),
        consultationNumber,
        paymentType: transaction.type,
      });
      result.taxRatePct = taxRatePct;
      // Una sola tasa para todo el período, o ninguna: si las líneas difieren,
      // el desglose de la factura no puede salir del encabezado.
      group.taxRates.add(taxRatePct);
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
    const taxRatePct = group.taxRates.size === 1 ? [...group.taxRates][0] : null;

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
          taxRatePct,
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
          taxRatePct,
        },
      });

      for (const { transaction, result } of calculatedItems) {
        let itemCreated = false;
        try {
          await tx.settlementItem.create({
            data: {
              settlementId: settlement.id,
              transactionId: transaction.id,
              amount: transaction.amount,
              commissionAmt: result.commissionCents / 100,
              commissionPct: result.ratePct,
              consultationNumber: result.consultationNumber,
              commissionPlanVersion: COMMISSION_PLAN_VERSION,
              taxRatePct: result.taxRatePct,
              processingFeeAmt: result.processingFeeCents / 100,
              netAmount: result.professionalInvoiceCents / 100,
            },
          });
          itemCreated = true;
        } catch (error) {
          if (error?.code !== "P2002") throw error;
        }

        if (itemCreated) {
          await tx.paymentTransaction.update({
            where: { id: transaction.id },
            data: { processingFee: result.processingFeeCents / 100 },
          });
          const appointmentCommission = await tx.settlementItem.aggregate({
            where: {
              transaction: { appointmentId: transaction.appointment.id },
            },
            _sum: { commissionAmt: true },
          });
          await tx.appointment.update({
            where: { id: transaction.appointment.id },
            data: {
              commissionFee: Number(appointmentCommission._sum.commissionAmt || 0),
            },
          });
          itemsCreated += 1;
        }
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
