import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import LeadRow from "@/components/admin/LeadRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS = [
  { key: "all", label: "Todos", status: null },
  { key: "NEW", label: "Nuevos", status: "NEW" },
  { key: "CONTACTED", label: "Contactados", status: "CONTACTED" },
  { key: "CONVERTED", label: "Registrados", status: "CONVERTED" },
  { key: "DISCARDED", label: "Descartados", status: "DISCARDED" },
];

const LEGEND = [
  { label: "Sin atender", desc: "todavía nadie respondió", dot: "bg-amber-500" },
  { label: "Contactado", desc: "ya le respondiste", dot: "bg-sky-500" },
  { label: "Registrado", desc: "se creó una cuenta con ese correo", dot: "bg-emerald-500" },
  { label: "Descartado", desc: "spam o no aplica", dot: "bg-neutral-400" },
];

export default async function AdminLeadsPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const sp = (await searchParams) || {};
  const active = FILTERS.find((f) => f.key === sp.estado) || FILTERS[0];

  let leads = [];
  let counts = {};
  try {
    const [rows, grouped] = await Promise.all([
      prisma.lead.findMany({
        where: active.status ? { status: active.status } : {},
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    leads = rows;
    counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  } catch {
    // Si la DB no responde, la vista se renderiza vacía en vez de romper.
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const countFor = (f) => (f.status ? counts[f.status] || 0 : totalAll);

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabecera explicativa */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Marketing</div>
              <h1 className="mt-1 text-2xl font-bold text-neutral-950">Leads de contacto</h1>
              <p className="mt-1 text-sm text-neutral-600">
                Personas que escribieron por el formulario de contacto o del FAQ. Llegan solas — no hay que
                cargarlas a mano. Cada una guarda de dónde vino (campaña/UTM). Respondé desde acá con un clic y
                marcá el estado para no perder el hilo.
              </p>
            </div>
            <Link
              href="/panel/admin/marketing"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              ← Marketing
            </Link>
          </div>

          {/* Leyenda de estados */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                <strong className="text-neutral-800">{l.label}</strong> — {l.desc}
              </span>
            ))}
          </div>
        </section>

        {/* Filtros como chips de un clic */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = f.key === active.key;
            const href = f.status ? `/panel/admin/leads?estado=${f.key}` : "/panel/admin/leads";
            return (
              <Link
                key={f.key}
                href={href}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-brand-400"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${isActive ? "text-white/80" : "text-neutral-400"}`}>
                  {countFor(f)}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Tabla */}
        <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
          {leads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-neutral-700">
                {active.status ? "No hay leads en este estado." : "Todavía no llegaron leads."}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-neutral-500">
                Los leads entran solos cuando alguien envía el formulario de{" "}
                <Link href="/contacto" className="font-semibold text-brand-700 hover:underline">/contacto</Link>{" "}
                o del FAQ. Para atribuir campañas, usá el constructor de enlaces con UTM en{" "}
                <Link href="/panel/admin/marketing" className="font-semibold text-brand-700 hover:underline">Marketing</Link>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.12em] text-neutral-500">
                    <th className="py-2 pr-4">Contacto</th>
                    <th className="py-2 pr-4">Canal</th>
                    <th className="py-2 pr-4">Mensaje</th>
                    <th className="py-2 pr-4">Origen</th>
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {leads.map((lead) => (
                    <LeadRow key={lead.id} lead={lead} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
