const COSTA_RICA_OFFSET_MS = 6 * 60 * 60 * 1000;

function utcBoundary(year, month, day) {
  return new Date(Date.UTC(year, month, day, 6, 0, 0, 0));
}

/** Returns the last completed 1-15 or 16-end-of-month period in Costa Rica time. */
export function previousClosedSettlementPeriod(now = new Date()) {
  const costaRicaNow = new Date(now.getTime() - COSTA_RICA_OFFSET_MS);
  const year = costaRicaNow.getUTCFullYear();
  const month = costaRicaNow.getUTCMonth();
  const day = costaRicaNow.getUTCDate();

  if (day >= 16) {
    const start = utcBoundary(year, month, 1);
    const next = utcBoundary(year, month, 16);
    return { periodStart: start, periodEnd: new Date(next.getTime() - 1) };
  }

  const start = utcBoundary(year, month - 1, 16);
  const next = utcBoundary(year, month, 1);
  return { periodStart: start, periodEnd: new Date(next.getTime() - 1) };
}
