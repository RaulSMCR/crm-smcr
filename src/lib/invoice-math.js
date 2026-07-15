/** Desglosa un total con impuesto incluido, usando centavos enteros. */
export function splitTaxIncluded(totalCents, ratePercent) {
  const total = Math.round(Number(totalCents));
  const rate = Number(ratePercent);
  if (!Number.isFinite(total) || !Number.isFinite(rate) || rate < 0) {
    throw new Error("Total y tasa de impuesto inválidos.");
  }
  const baseCents = Math.round(total / (1 + rate / 100));
  return { baseCents, taxCents: total - baseCents };
}
