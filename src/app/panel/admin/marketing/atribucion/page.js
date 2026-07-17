import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { upsertChannelSpend, deleteChannelSpend } from "@/actions/channel-spend-actions";
import {
  annotateLeads,
  groupAttribution,
  totalsRow,
  monthsInRange,
  ORGANIC_KEY,
} from "@/lib/attribution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGES = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
];

function pct(rate) {
  return `${Math.round((rate || 0) * 100)}%`;
}
function crc(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(Number(value));
}
function days(value) {
  return value == null ? "—" : `${value.toFixed(1)} d`;
}

/** Barrita CSS simple para la tasa (gráfico trivial permitido). */
function RateBar({ rate, tone = "brand" }) {
  const w = Math.max(2, Math.round((rate || 0) * 100));
  const color = tone === "accent" ? "bg-accent-600" : "bg-brand-600";
  return (
    <div className="mt-1 h-1.5 w-full rounded bg-neutral-200">
      <div className={`h-1.5 rounded ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function AttributionDashboard({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const sp = (await searchParams) || {};
  const dias = [7, 30, 90].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const drillSource = sp.source ? String(sp.source) : null;

  const to = new Date();
  const from = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  let leads = [], appts = [], spends = [];
  try {
    leads = await prisma.lead.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, utmSource: true, utmCampaign: true, createdAt: true, userId: true },
    });
    const userIds = [...new Set(leads.filter((l) => l.userId).map((l) => l.userId))];
    appts = userIds.length
      ? await prisma.appointment.findMany({
          where: { patientId: { in: userIds } },
          select: { patientId: true, createdAt: true, paymentStatus: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    spends = await prisma.channelSpend.findMany({ orderBy: [{ month: "desc" }, { source: "asc" }] });
  } catch {
    // Si la DB no responde, la vista se renderiza vacía en vez de romper.
  }

  // Índice cita-por-usuario (ya ordenadas asc)
  const apptsByUser = new Map();
  for (const a of appts) {
    if (!apptsByUser.has(a.patientId)) apptsByUser.set(a.patientId, []);
    apptsByUser.get(a.patientId).push(a);
  }

  // Gasto por fuente dentro del rango (para el CAC)
  const rangeMonths = new Set(monthsInRange(from, to));
  const spendBySource = new Map();
  for (const s of spends) {
    if (!rangeMonths.has(s.month)) continue;
    const key = s.source.toLowerCase();
    spendBySource.set(key, (spendBySource.get(key) || 0) + Number(s.amount));
  }

  const annotated = annotateLeads(leads, apptsByUser);
  const rows = groupAttribution(annotated, (l) => l.utmSource, spendBySource);
  const totals = totalsRow(rows);

  // Drill-down por campaña de una fuente
  let drillRows = null;
  if (drillSource) {
    const subset = annotated.filter((l) =>
      drillSource === ORGANIC_KEY ? !l.utmSource : l.utmSource === drillSource,
    );
    drillRows = groupAttribution(subset, (l) => l.utmCampaign, new Map());
  }

  const buildHref = (next) => {
    const params = new URLSearchParams({ dias: String(dias) });
    if (next.source) params.set("source", next.source);
    if (next.dias) params.set("dias", String(next.dias));
    return `/panel/admin/marketing/atribucion?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Marketing</div>
              <h1 className="mt-1 text-2xl font-bold text-neutral-950">Atribución de marketing</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Embudo por fuente de campaña (utm_source): de <strong>lead</strong> a{" "}
                <strong>agendar</strong> y <strong>pagar la primera cita</strong>. Se deriva de eventos reales
                (lead → usuario vinculado → cita → pago); no depende de estados manuales. Lo recurrente no se
                mide acá (es desempeño del profesional).
              </p>
            </div>
            <Link href="/panel/admin/marketing" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
              ← Marketing
            </Link>
          </div>

          {/* Filtro de rango */}
          <div className="mt-4 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link
                key={r.dias}
                href={buildHref({ dias: r.dias, source: drillSource })}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  r.dias === dias
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-brand-400"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Tabla principal por fuente */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <h2 className="text-lg font-bold text-neutral-950">Por fuente (utm_source)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            La fila <strong>{ORGANIC_KEY}</strong> son los leads sin campaña — la línea base, no se esconde.
            Clic en una fuente para ver el detalle por campaña.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                  <th className="py-2 pr-4">Fuente</th>
                  <th className="py-2 pr-4">Leads</th>
                  <th className="py-2 pr-4">Agendó 1ª cita</th>
                  <th className="py-2 pr-4">Pagó 1ª cita</th>
                  <th className="py-2 pr-4">Mediana a agendar</th>
                  <th className="py-2 pr-4">Gasto</th>
                  <th className="py-2 pr-4">CAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-sm text-neutral-500">Sin leads en este rango.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.source} className={r.isOrganic ? "bg-neutral-100/50" : ""}>
                    <td className="py-2 pr-4 font-medium text-neutral-900">
                      {r.isOrganic ? (
                        <span>{r.source}</span>
                      ) : (
                        <Link href={buildHref({ source: r.source })} className="text-brand-700 hover:underline">{r.source}</Link>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-neutral-900">{r.leads}</td>
                    <td className="py-2 pr-4">
                      <div>{r.scheduled} <span className="text-neutral-500">({pct(r.scheduleRate)})</span></div>
                      <RateBar rate={r.scheduleRate} />
                    </td>
                    <td className="py-2 pr-4">
                      <div>{r.paid} <span className="text-neutral-500">({pct(r.payRate)})</span></div>
                      <RateBar rate={r.payRate} tone="accent" />
                    </td>
                    <td className="py-2 pr-4 text-neutral-700">{days(r.medianDays)}</td>
                    <td className="py-2 pr-4 text-neutral-700">{crc(r.spend)}</td>
                    <td className="py-2 pr-4 font-semibold text-neutral-900">{crc(r.cac)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-neutral-300 text-sm font-bold text-neutral-900">
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4">{totals.leads}</td>
                    <td className="py-2 pr-4">{totals.scheduled} ({pct(totals.scheduleRate)})</td>
                    <td className="py-2 pr-4">{totals.paid} ({pct(totals.payRate)})</td>
                    <td className="py-2 pr-4">—</td>
                    <td className="py-2 pr-4">{crc(totals.spend || null)}</td>
                    <td className="py-2 pr-4">{crc(totals.cac)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Agendó/Pagó = el usuario vinculado al lead (mismo email registrado) creó/pagó su 1ª cita.
            CAC = gasto del canal en el período / pacientes que pagaron. NUEVO→AGENDO y AGENDO→PAGO son las dos tasas mostradas.
          </p>
        </section>

        {/* Drill-down por campaña */}
        {drillRows ? (
          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-950">Detalle de «{drillSource}» por campaña</h2>
              <Link href={buildHref({})} className="text-xs font-semibold text-brand-700 hover:underline">Cerrar detalle ✕</Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                    <th className="py-2 pr-4">Campaña</th>
                    <th className="py-2 pr-4">Leads</th>
                    <th className="py-2 pr-4">Agendó</th>
                    <th className="py-2 pr-4">Pagó</th>
                    <th className="py-2 pr-4">Mediana a agendar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {drillRows.map((r) => (
                    <tr key={r.source}>
                      <td className="py-2 pr-4 font-medium text-neutral-900">{r.source}</td>
                      <td className="py-2 pr-4">{r.leads}</td>
                      <td className="py-2 pr-4">{r.scheduled} ({pct(r.scheduleRate)})</td>
                      <td className="py-2 pr-4">{r.paid} ({pct(r.payRate)})</td>
                      <td className="py-2 pr-4">{days(r.medianDays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Gasto por canal (para CAC) */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <h2 className="text-lg font-bold text-neutral-950">Gasto por canal (para el CAC)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Cargá el gasto publicitario mensual de cada fuente. El CAC de arriba usa el gasto de los meses que toca el rango.
          </p>

          <form action={upsertChannelSpend} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Canal (utm_source)</span>
              <input name="source" required placeholder="meta" className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Mes</span>
              <input name="month" type="month" required className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Monto (CRC)</span>
              <input name="amount" type="number" min="0" step="1" required placeholder="150000" className="w-36 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Guardar gasto
            </button>
          </form>

          {spends.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                    <th className="py-2 pr-4">Canal</th>
                    <th className="py-2 pr-4">Mes</th>
                    <th className="py-2 pr-4">Monto</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {spends.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-4 font-medium text-neutral-900">{s.source}</td>
                      <td className="py-2 pr-4 text-neutral-700">{s.month}</td>
                      <td className="py-2 pr-4 text-neutral-700">{crc(Number(s.amount))}</td>
                      <td className="py-2 pr-4">
                        <form action={deleteChannelSpend.bind(null, s.id)}>
                          <button type="submit" className="text-xs font-semibold text-rose-600 hover:underline">Eliminar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-xs text-neutral-400">Todavía no cargaste gasto. El CAC queda en «—» hasta que ingreses montos.</p>
          )}
        </section>
      </div>
    </div>
  );
}
