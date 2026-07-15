import { describe, expect, it } from "vitest";
import { splitTaxIncluded } from "../../src/lib/invoice-math.js";

describe("splitTaxIncluded", () => {
  it("desglosa 45,500 al 4%", () => {
    expect(splitTaxIncluded(45500, 4)).toEqual({ baseCents: 43750, taxCents: 1750 });
  });

  it("reconstruye siempre el total cuando hay redondeo", () => {
    const result = splitTaxIncluded(10001, 4);
    expect(result.baseCents + result.taxCents).toBe(10001);
  });

  it("permite una tasa de referencia de 13%", () => {
    const result = splitTaxIncluded(11300, 13);
    expect(result).toEqual({ baseCents: 10000, taxCents: 1300 });
  });
});
