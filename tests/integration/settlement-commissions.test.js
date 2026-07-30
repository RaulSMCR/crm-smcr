import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, transactionClient, getSession, revalidatePath } = vi.hoisted(() => {
  const transactionClient = {
    settlement: { upsert: vi.fn() },
    settlementItem: { create: vi.fn(), aggregate: vi.fn() },
    paymentTransaction: { update: vi.fn() },
    appointment: { update: vi.fn() },
  };
  const prisma = {
    paymentTransaction: { findMany: vi.fn() },
    appointment: { findMany: vi.fn() },
    invoice: { findUnique: vi.fn() },
    settlement: { updateMany: vi.fn() },
    $transaction: vi.fn((callback) => callback(transactionClient)),
  };

  return {
    prisma,
    transactionClient,
    getSession: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { generateSettlementPeriod } from "@/actions/settlement-actions";

const periodStart = new Date("2026-07-01T06:00:00.000Z");
const periodEnd = new Date("2026-07-16T05:59:59.999Z");
const appointment = {
  id: "appointment-1",
  patientId: "patient-1",
  professionalId: "professional-1",
  date: new Date("2026-07-10T15:00:00.000Z"),
  isFirstWithProfessional: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((callback) => callback(transactionClient));
  transactionClient.settlement.upsert.mockResolvedValue({ id: "settlement-1" });
  transactionClient.settlementItem.create.mockResolvedValue({});
  transactionClient.paymentTransaction.update.mockResolvedValue({});
  transactionClient.appointment.update.mockResolvedValue({});
});

describe("patient-retention settlement generation", () => {
  it("settles the first deposit and balance together as an effective 45% commission", async () => {
    prisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "deposit-1",
        patientId: "patient-1",
        professionalId: "professional-1",
        type: "DEPOSIT_50",
        amount: 20000,
        taxRate: 4,
        processingFee: 0,
        paidAt: new Date("2026-06-20T15:00:00.000Z"),
        appointment,
      },
      {
        id: "balance-1",
        patientId: "patient-1",
        professionalId: "professional-1",
        type: "BALANCE_50",
        amount: 20000,
        taxRate: 4,
        processingFee: 0,
        paidAt: new Date("2026-07-10T16:00:00.000Z"),
        appointment,
      },
    ]);
    prisma.appointment.findMany.mockResolvedValue([appointment]);
    transactionClient.settlementItem.aggregate
      .mockResolvedValueOnce({ _sum: { commissionAmt: 9615.39 } })
      .mockResolvedValueOnce({ _sum: { commissionAmt: 17307.7 } });

    const result = await generateSettlementPeriod({ periodStart, periodEnd });

    expect(result).toEqual({ success: true, settlementsCreated: 1, items: 2 });
    expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "APPROVED",
          settlementItem: null,
          appointment: { status: "COMPLETED" },
        }),
      })
    );
    expect(transactionClient.settlementItem.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "deposit-1",
          commissionPct: 50,
          consultationNumber: 1,
          commissionPlanVersion: "patient-retention-2026-07",
        }),
      })
    );
    expect(transactionClient.settlementItem.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: "balance-1",
          commissionPct: 40,
          consultationNumber: 1,
          commissionPlanVersion: "patient-retention-2026-07",
        }),
      })
    );
    expect(transactionClient.appointment.update).toHaveBeenLastCalledWith({
      where: { id: "appointment-1" },
      data: { commissionFee: 17307.7 },
    });
  });

  it("does not create settlements when the period has no eligible completed payments", async () => {
    prisma.paymentTransaction.findMany.mockResolvedValue([]);

    await expect(generateSettlementPeriod({ periodStart, periodEnd })).resolves.toEqual({
      success: true,
      settlementsCreated: 0,
      items: 0,
    });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
