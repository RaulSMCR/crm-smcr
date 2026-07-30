import { describe, expect, it } from "vitest";
import {
  COMMISSION_PLAN_VERSION,
  baseCentsFromGross,
  buildConsultationNumberMap,
  calculateProfessionalSettlementItem,
  commissionRateForConsultation,
  commissionRateForPayment,
} from "../../src/lib/commission-plan.js";

describe("patient-retention professional commissions", () => {
  it("versions the immutable calculation plan", () => {
    expect(COMMISSION_PLAN_VERSION).toBe("patient-retention-2026-07");
  });

  it("uses tax-exclusive revenue for commission calculations", () => {
    expect(baseCentsFromGross(3120000, 4)).toBe(3000000);
  });

  it.each([
    [1, 45],
    [2, 35],
    [3, 30],
    [4, 25],
    [5, 20],
    [8, 20],
    [9, 15],
    [28, 15],
    [29, 10],
    [200, 10],
  ])("applies %s%% to consultation %s", (consultationNumber, ratePct) => {
    expect(commissionRateForConsultation(consultationNumber)).toBe(ratePct);
  });

  it("applies 50% to the first deposit and 40% to its balance", () => {
    expect(
      commissionRateForPayment({ consultationNumber: 1, paymentType: "DEPOSIT_50" })
    ).toBe(50);
    expect(
      commissionRateForPayment({ consultationNumber: 1, paymentType: "BALANCE_50" })
    ).toBe(40);
    expect(
      commissionRateForPayment({ consultationNumber: 1, paymentType: "FULL_100" })
    ).toBe(45);
  });

  it("produces an effective 45% commission across equal first-payment halves", () => {
    const deposit = calculateProfessionalSettlementItem({
      grossCents: 2000000,
      taxRatePct: 4,
      processingFeeCents: 0,
      consultationNumber: 1,
      paymentType: "DEPOSIT_50",
    });
    const balance = calculateProfessionalSettlementItem({
      grossCents: 2000000,
      taxRatePct: 4,
      processingFeeCents: 0,
      consultationNumber: 1,
      paymentType: "BALANCE_50",
    });
    const fullBaseCents = baseCentsFromGross(4000000, 4);

    expect(deposit.ratePct).toBe(50);
    expect(balance.ratePct).toBe(40);
    expect(
      Math.abs(
        deposit.commissionCents +
          balance.commissionCents -
          Math.round(fullBaseCents * 0.45)
      )
    ).toBeLessThanOrEqual(1);
  });

  it("numbers completed consultations independently per patient-professional pair", () => {
    const numbers = buildConsultationNumberMap([
      {
        id: "later",
        patientId: "patient-1",
        professionalId: "pro-1",
        date: new Date("2026-07-15T12:00:00.000Z"),
      },
      {
        id: "first",
        patientId: "patient-1",
        professionalId: "pro-1",
        date: new Date("2026-07-01T12:00:00.000Z"),
      },
      {
        id: "other-pro",
        patientId: "patient-1",
        professionalId: "pro-2",
        date: new Date("2026-07-20T12:00:00.000Z"),
      },
      {
        id: "other-patient",
        patientId: "patient-2",
        professionalId: "pro-1",
        date: new Date("2026-07-20T12:00:00.000Z"),
      },
    ]);

    expect(numbers.get("first")).toBe(1);
    expect(numbers.get("later")).toBe(2);
    expect(numbers.get("other-pro")).toBe(1);
    expect(numbers.get("other-patient")).toBe(1);
  });

  it("deducts the processing fee before calculating the professional invoice", () => {
    const result = calculateProfessionalSettlementItem({
      grossCents: 3120000,
      taxRatePct: 4,
      processingFeeCents: 14000,
      consultationNumber: 5,
      paymentType: "FULL_100",
    });

    expect(result.baseCents).toBe(3000000);
    expect(result.commissionCents).toBe(600000);
    expect(result.professionalBaseCents).toBe(2386000);
    expect(result.professionalInvoiceCents).toBe(2481440);
  });

  it("rejects invalid consultation numbers", () => {
    expect(() => commissionRateForConsultation(0)).toThrow(
      "Número de consulta inválido."
    );
  });
});
