import { describe, expect, it } from "vitest";
import { previousClosedSettlementPeriod } from "../../src/lib/settlement-period.js";

describe("settlement periods in Costa Rica", () => {
  it("closes the first half on the 16th", () => {
    const result = previousClosedSettlementPeriod(new Date("2026-07-16T06:00:00.000Z"));
    expect(result.periodStart.toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-07-16T05:59:59.999Z");
  });

  it("closes the second half on the first day of the next month", () => {
    const result = previousClosedSettlementPeriod(new Date("2026-08-01T06:00:00.000Z"));
    expect(result.periodStart.toISOString()).toBe("2026-07-16T06:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-08-01T05:59:59.999Z");
  });
});
