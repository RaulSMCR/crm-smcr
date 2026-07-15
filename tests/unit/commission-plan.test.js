import { describe, expect, it } from "vitest";
import { allocateCommission, calculateProfessionalSettlementItem, baseCentsFromGross } from "../../src/lib/commission-plan.js";

describe("progressive professional commissions", () => {
  it("uses tax-exclusive revenue for the brackets", () => {
    expect(baseCentsFromGross(3120000, 4)).toBe(3000000);
  });

  it("applies marginal brackets without a cliff", () => {
    const first = allocateCommission(60000000, 0);
    const second = allocateCommission(30000000, 60000000);
    expect(first.commissionCents).toBe(12000000);
    expect(second.commissionCents).toBe(4500000);
    expect(second.breakdown[0].ratePct).toBe(15);
  });

  it("deducts ONVO fee before calculating the professional invoice", () => {
    const result = calculateProfessionalSettlementItem({
      grossCents: 3120000,
      taxRatePct: 4,
      processingFeeCents: 14000,
      cumulativeBeforeCents: 0,
    });
    expect(result.baseCents).toBe(3000000);
    expect(result.commissionCents).toBe(600000);
    expect(result.professionalBaseCents).toBe(2386000);
    expect(result.professionalInvoiceCents).toBe(2481440);
  });
});
