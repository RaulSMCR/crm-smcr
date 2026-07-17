// Lógica pura del dashboard de atribución (sin Prisma, testeable).
//
// El embudo de MARKETING mide solo hasta la primera cita pagada:
//   NUEVO (lead creado) → AGENDÓ 1ª cita → PAGÓ 1ª cita.
// Lo recurrente NO se mide acá (depende del profesional, no del marketing).
//
// "Agendó" = el usuario vinculado al lead (Lead.userId, que se setea cuando el
// email del lead se registra) tiene una cita creada en o después del lead.
// "Pagó"   = esa primera cita tiene paymentStatus distinto de UNPAID.

export const ORGANIC_KEY = "(directo / orgánico)";

export function median(numbers) {
  const arr = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

/** Primera cita del usuario del lead creada en o después de la creación del lead. */
export function firstScheduledAppointment(lead, apptsByUser) {
  if (!lead.userId) return null;
  const appts = apptsByUser.get(lead.userId) || [];
  return appts.find((a) => new Date(a.createdAt) >= new Date(lead.createdAt)) || null;
}

/** Anota cada lead con scheduled / paid / timeToScheduleMs. */
export function annotateLeads(leads, apptsByUser) {
  return leads.map((lead) => {
    const appt = firstScheduledAppointment(lead, apptsByUser);
    const scheduled = Boolean(appt);
    const paid = scheduled && appt.paymentStatus && appt.paymentStatus !== "UNPAID";
    const timeToScheduleMs = scheduled
      ? new Date(appt.createdAt) - new Date(lead.createdAt)
      : null;
    return { ...lead, scheduled, paid, timeToScheduleMs };
  });
}

function emptyBucket(key) {
  return { key, leads: 0, scheduled: 0, paid: 0, times: [] };
}

function finalizeRow(bucket, spend) {
  const scheduleRate = bucket.leads ? bucket.scheduled / bucket.leads : 0;
  const payRate = bucket.scheduled ? bucket.paid / bucket.scheduled : 0;
  const medianMs = median(bucket.times);
  const medianDays = medianMs == null ? null : medianMs / 86400000;
  const cac = spend != null && bucket.paid > 0 ? spend / bucket.paid : null;
  return {
    source: bucket.key,
    isOrganic: bucket.key === ORGANIC_KEY,
    leads: bucket.leads,
    scheduled: bucket.scheduled,
    paid: bucket.paid,
    scheduleRate,
    payRate,
    medianDays,
    spend: spend ?? null,
    cac,
  };
}

/**
 * Agrupa por una clave (utmSource por defecto, o utmCampaign para el drill-down)
 * y devuelve filas con conteos, tasas, tiempo mediano y CAC.
 *
 * @param {Array} annotatedLeads  salida de annotateLeads
 * @param {(lead)=>string|null} keyOf  cómo agrupar (source o campaign)
 * @param {Map<string,number>} spendByKey  gasto por clave (lowercase) para el CAC
 */
export function groupAttribution(annotatedLeads, keyOf, spendByKey = new Map()) {
  const buckets = new Map();
  for (const lead of annotatedLeads) {
    const raw = keyOf(lead);
    const key = raw ? String(raw) : ORGANIC_KEY;
    if (!buckets.has(key)) buckets.set(key, emptyBucket(key));
    const b = buckets.get(key);
    b.leads += 1;
    if (lead.scheduled) b.scheduled += 1;
    if (lead.paid) b.paid += 1;
    if (lead.timeToScheduleMs != null) b.times.push(lead.timeToScheduleMs);
  }

  const rows = [...buckets.values()].map((b) =>
    finalizeRow(b, spendByKey.get(b.key.toLowerCase())),
  );

  // Orgánico siempre al final (es la línea base, no se esconde); el resto por leads desc.
  return rows.sort((a, b) => {
    if (a.isOrganic) return 1;
    if (b.isOrganic) return -1;
    return b.leads - a.leads;
  });
}

/** Totales de la tabla (para la fila de total general). */
export function totalsRow(rows) {
  const acc = rows.reduce(
    (t, r) => {
      t.leads += r.leads;
      t.scheduled += r.scheduled;
      t.paid += r.paid;
      if (r.spend != null) t.spend += r.spend;
      return t;
    },
    { leads: 0, scheduled: 0, paid: 0, spend: 0 },
  );
  return {
    ...acc,
    scheduleRate: acc.leads ? acc.scheduled / acc.leads : 0,
    payRate: acc.scheduled ? acc.paid / acc.scheduled : 0,
    cac: acc.spend > 0 && acc.paid > 0 ? acc.spend / acc.paid : null,
  };
}

/** Lista de meses "YYYY-MM" que cubre un rango de fechas (para sumar gasto). */
export function monthsInRange(from, to) {
  const out = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
