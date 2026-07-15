export const COMMISSION_PLAN_VERSION = "progressive-2026-07";

// Limits are cumulative pre-tax revenue per professional and settlement period.
export const COMMISSION_TIERS = [
  { limitCents: 60000000, ratePct: 20 },
  { limitCents: 120000000, ratePct: 15 },
  { limitCents: 165000000, ratePct: 10 },
  { limitCents: 210000000, ratePct: 7 },
  { limitCents: Number.POSITIVE_INFINITY, ratePct: 2 },
];

export function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function baseCentsFromGross(grossCents, taxRatePct = 4) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const rate = Number(taxRatePct);
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Tasa de impuesto inválida.");
  return Math.round(gross / (1 + rate / 100));
}

export function estimateOnvoFeeCents(grossCents, method = "card") {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const normalized = String(method || "card").toLowerCase();
  const rate = normalized.includes("sinpe_movil")
    ? Number(process.env.ONVO_SINPE_MOVIL_RATE || 1.5)
    : normalized.includes("sinpe")
      ? Number(process.env.ONVO_SINPE_RATE || 2.5)
      : Number(process.env.ONVO_CARD_RATE || 3.9);
  const fixed = normalized.includes("sinpe")
    ? Number(process.env.ONVO_SINPE_FIXED_FEE_CRC || 0)
    : Number(process.env.ONVO_FIXED_FEE_CRC || 200);
  return Math.max(0, Math.round(gross * rate / 100 + fixed));
}

export function allocateCommission(baseCents, cumulativeBeforeCents = 0) {
  let remaining = Math.max(0, Math.round(Number(baseCents) || 0));
  let cursor = Math.max(0, Math.round(Number(cumulativeBeforeCents) || 0));
  let commission = 0;
  const breakdown = [];

  for (const tier of COMMISSION_TIERS) {
    if (remaining <= 0) break;
    const available = tier.limitCents === Number.POSITIVE_INFINITY
      ? remaining
      : Math.max(0, tier.limitCents - cursor);
    const amount = Math.min(remaining, available);
    if (amount <= 0) continue;
    const tierCommission = Math.round(amount * tier.ratePct / 100);
    commission += tierCommission;
    breakdown.push({ amountCents: amount, ratePct: tier.ratePct, commissionCents: tierCommission });
    remaining -= amount;
    cursor += amount;
  }

  return {
    commissionCents: commission,
    cumulativeAfterCents: cursor,
    effectiveRatePct: baseCents > 0 ? Math.round((commission / baseCents) * 10000) / 100 : 0,
    breakdown,
  };
}

export function calculateProfessionalSettlementItem({ grossCents, taxRatePct = 4, processingFeeCents = 0, cumulativeBeforeCents = 0 }) {
  const baseCents = baseCentsFromGross(grossCents, taxRatePct);
  const allocation = allocateCommission(baseCents, cumulativeBeforeCents);
  const fee = Math.max(0, Math.round(Number(processingFeeCents) || 0));
  const professionalBaseCents = Math.max(0, baseCents - allocation.commissionCents - fee);
  const professionalTaxCents = Math.round(professionalBaseCents * Number(taxRatePct) / 100);
  return {
    ...allocation,
    grossCents: Math.round(Number(grossCents) || 0),
    baseCents,
    processingFeeCents: fee,
    professionalBaseCents,
    professionalTaxCents,
    professionalInvoiceCents: professionalBaseCents + professionalTaxCents,
  };
}
