// src/app/admin/professionals/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminApproveButton from "@/components/AdminApproveButton";

export const revalidate = 0;

function formatDateTime(date) {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return String(date);
  }
}

function Pill({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-800",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
        (tones[tone] || tones.neutral)
      }
    >
      {children}
    </span>
  );
}

// Filtros por querystring:
// ?tab=pending | approved | all
export default async function AdminProfessionalsPage({ searchParams }) {
  const tab = (searchParams?.tab || "pending").toString();

  const where =
    tab === "pending"
      ? { isApproved: false, emailVerified: true }
      : tab === "approved"
      ? { isApproved: true }
      : {};

  const [countPending, countApproved, countAll] = await Promise.all([
    prisma.professional.count({
      where: { isApproved: false, emailVerified: true },
    }),
    prisma.professional.count({
      where: { isApproved: true },
    }),
    prisma.professional.count(),
  ]);

  const professionals = await prisma.professional.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      phone: true,
      avatarUrl: true,
      resumeUrl: true,
      emailVerified: true,
      isApproved: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-neutral-900">Profesionales</h1>
          <Link href="/admin" className="text-sm text-brand-700 underline">
            ← Volver al dashboard
          </Link>
        </div>

        <p className="text-sm text-neutral-600">
          Pendientes (email verificado), aprobados o todos. Máx 100 por vista.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/admin/professionals?tab=pending"
            className={
              "rounded-full border px-3 py-1 text-sm hover:bg-neutral-50 " +
              (tab === "pending"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white")
            }
          >
            Pendientes ({countPending})
          </Link>

          <Link
            href="/admin/professionals?tab=approved"
            className={
              "rounded-full border px-3 py-1 text-sm hover:bg-neutral-50 " +
              (tab === "approved"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white")
            }
          >
            Aprobados ({countApproved})
          </Link>

          <Link
            href="/admin/professionals?tab=all"
            className={
              "rounded-full border px-3 py-1 text-sm hover:bg-neutral-50 " +
              (tab === "all"
                ? "bg-neutral-900 text-white border-neutral-900"
                : "bg-white")
            }
          >
            Todos ({countAll})
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Listado</h2>
          <Pill tone="neutral">{professionals.length} mostrado(s)</Pill>
        </div>

        {professionals.length === 0 ? (
          <div className="p-5 text-sm text-neutral-700">
            No hay resultados para este filtro.
          </div>
        ) : (
          <ul className="divide-y">
            {professionals.map((p) => (
              <li
                key={p.id}
                className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/professionals/${p.id}`}
                      className="font-semibold text-brand-800 underline"
                    >
                      {p.name}
                    </Link>

                    <Pill tone={p.emailVerified ? "green" : "yellow"}>
                      {p.emailVerified ? "Email verificado" : "Email NO verificado"}
                    </Pill>

                    <Pill tone={p.isApproved ? "green" : "yellow"}>
                      {p.isApproved ? "Aprobado" : "Pendiente"}
                    </Pill>
                  </div>

                  <div className="text-sm text-neutral-700">{p.profession}</div>
                  <div className="text-sm text-neutral-600 truncate">{p.email}</div>
                  {p.phone ? (
                    <div className="text-xs text-neutral-500">Tel: {p.phone}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-3 pt-1">
                    {p.avatarUrl ? (
                      <a
                        href={p.avatarUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-700 underline"
                      >
                        Ver foto
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-500">Sin foto</span>
                    )}

                    {p.resumeUrl ? (
                      <a
                        href={p.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-700 underline"
                      >
                        Ver CV
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-500">Sin CV</span>
                    )}

                    <span className="text-xs text-neutral-500">
                      Alta: {formatDateTime(new Date(p.createdAt))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <Link
                    href={`/admin/professionals/${p.id}`}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50 text-center"
                  >
                    Ver detalle
                  </Link>

                  {/* Solo permitir aprobar si está verificado y no aprobado */}
                  {!p.isApproved ? (
                    <AdminApproveButton
                      label="Aprobar"
                      endpoint={`/api/admin/professionals/${p.id}/approve`}
                      disabled={!p.emailVerified}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border px-4 py-2 text-sm opacity-60 cursor-not-allowed"
                    >
                      Ya aprobado
                    </button>
                  )}

                  {!p.emailVerified && !p.isApproved ? (
                    <p className="text-[11px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2 max-w-[240px]">
                      No se puede aprobar hasta que verifique su email.
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
