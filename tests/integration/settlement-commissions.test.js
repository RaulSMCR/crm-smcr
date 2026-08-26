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
    // Los números de consulta ya emitidos en liquidaciones anteriores: se leen
    // para no renumerar hacia atrás lo que ya se facturó.
    settlementItem: { findMany: vi.fn() },
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
  prisma.settlementItem.findMany.mockResolvedValue([]);
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
    // `appointment.status = COMPLETED` dejó de ser condición general: se exige
    // por rama, porque la multa por cancelación tardía se cobra sobre una cita
    // que nunca llega a COMPLETED y aun así se liquida.
    const [{ where }] = prisma.paymentTransaction.findMany.mock.calls[0];
    expect(where).toEqual(
      expect.objectContaining({ status: "APPROVED", settlementItem: null })
    );
    expect(where.appointment).toBeUndefined();

    const tiposPorRama = where.OR.map((rama) => rama.type);
    expect(tiposPorRama).toContainEqual({ in: ["BALANCE_50", "FULL_100"] });
    expect(tiposPorRama).toContain("DEPOSIT_50");
    // La multa entra a liquidación: antes se quedaba fuera y el 100% se lo
    // llevaba la plataforma.
    expect(tiposPorRama).toContain("PENALTY_50");

    const ramaConsulta = where.OR.find(
      (rama) => rama.type?.in?.includes("FULL_100")
    );
    expect(ramaConsulta.appointment).toEqual({ status: "COMPLETED" });

    const ramaMulta = where.OR.find((rama) => rama.type === "PENALTY_50");
    expect(ramaMulta.appointment).toBeUndefined();
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

  it("liquida la multa por cancelación tardía y le deja neto al profesional", async () => {
    // Cita cancelada fuera de tiempo: nunca llega a COMPLETED, pero el paciente
    // pagó el enlace de la multa. Antes esto no entraba a ninguna liquidación y
    // el 100% se quedaba en la plataforma.
    const citaCancelada = {
      id: "appointment-2",
      patientId: "patient-1",
      professionalId: "professional-1",
      date: new Date("2026-07-12T15:00:00.000Z"),
      isFirstWithProfessional: false,
    };

    prisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "penalty-1",
        patientId: "patient-1",
        professionalId: "professional-1",
        type: "PENALTY_50",
        amount: 20000,
        taxRate: 4,
        processingFee: 0,
        paidAt: new Date("2026-07-12T18:00:00.000Z"),
        appointment: citaCancelada,
      },
    ]);
    // La cita cancelada ocupa la posición 2: la 1 ya la consumió una consulta
    // anterior que sí se prestó.
    prisma.appointment.findMany.mockResolvedValue([appointment, citaCancelada]);
    transactionClient.settlementItem.aggregate.mockResolvedValue({
      _sum: { commissionAmt: 6730.77 },
    });

    const result = await generateSettlementPeriod({ periodStart, periodEnd });

    expect(result).toEqual({ success: true, settlementsCreated: 1, items: 1 });

    const [[llamada]] = transactionClient.settlementItem.create.mock.calls;
    // Segunda posición de la secuencia → 35%, la tasa de esa consulta.
    expect(llamada.data.commissionPct).toBe(35);
    expect(llamada.data.consultationNumber).toBe(2);
    expect(llamada.data.commissionPlanVersion).toBe("patient-retention-2026-07");
    // Lo que importa: al profesional le queda algo.
    expect(Number(llamada.data.netAmount)).toBeGreaterThan(0);
  });

  it("respeta un número de consulta ya emitido en una liquidación anterior", async () => {
    const citaTardia = {
      id: "appointment-3",
      patientId: "patient-1",
      professionalId: "professional-1",
      date: new Date("2026-07-05T15:00:00.000Z"),
      isFirstWithProfessional: false,
    };

    prisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "penalty-2",
        patientId: "patient-1",
        professionalId: "professional-1",
        type: "PENALTY_50",
        amount: 20000,
        taxRate: 4,
        processingFee: 0,
        paidAt: new Date("2026-07-14T18:00:00.000Z"),
        appointment: citaTardia,
      },
    ]);
    prisma.appointment.findMany.mockResolvedValue([citaTardia, appointment]);
    // `appointment-1` es posterior en fecha pero ya se liquidó como la nº 1.
    prisma.settlementItem.findMany.mockResolvedValue([
      { consultationNumber: 1, transaction: { appointmentId: "appointment-1" } },
    ]);
    transactionClient.settlementItem.aggregate.mockResolvedValue({
      _sum: { commissionAmt: 0 },
    });

    await generateSettlementPeriod({ periodStart, periodEnd });

    const [[llamada]] = transactionClient.settlementItem.create.mock.calls;
    // Pese a ser anterior en fecha, no puede tomar la posición 1: ya se facturó.
    expect(llamada.data.consultationNumber).toBe(2);
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
