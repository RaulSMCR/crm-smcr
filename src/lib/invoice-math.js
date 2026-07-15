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

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function computeInvoiceLine(lineInput = {}) {
  const quantity = round2(toNumber(lineInput.quantity, 1));
  const unitPrice = round2(toNumber(lineInput.unitPrice, 0));
  const discountPercent = round2(toNumber(lineInput.discountPercent, 0));
  const taxRate = round2(toNumber(lineInput.taxRate, 0));
  const gross = round2(quantity * unitPrice);
  const discount = round2(gross * (discountPercent / 100));
  const lineSubtotal = round2(gross - discount);
  const taxAmount = round2(lineSubtotal * (taxRate / 100));
  return { quantity, unitPrice, discountPercent, taxRate, taxAmount, lineSubtotal, lineTotal: round2(lineSubtotal + taxAmount) };
}
