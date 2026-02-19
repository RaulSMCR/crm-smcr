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
    <span className={`text-xs px-2 py-1 rounded-full ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

// ?tab=pending | approved | all
export default async function AdminProfessionalsPage({ searchParams }) {
  const tab = (searchParams?.tab || "pending").toString();

  const where =
    tab === "pending"
      ? { isApproved: false, user: { emailVerified: true } }
      : tab === "approved"
      ? { isApproved: true }
      : {};

  const [countPending, countApproved, countAll] = await Promise.all([
    prisma.professionalProfile.count({
      where: { isApproved: false, user: { emailVerified: true } },
    }),
    prisma.professionalProfile.count({ where: { isApproved: true } }),
    prisma.professionalProfile.count(),
  ]);

  const professionals = await prisma.professionalProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      slug: true,
      specialty: true,
      licenseNumber: true,
      avatarUrl: true,
      cvUrl: true,
      isApproved: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          emailVerified: true,
        },
      },
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Profesionales</h1>
        <Link className="text-slate-600 hover:underline" href="/admin">
          ← Volver al dashboard
        </Link>
      </div>

      <p className="text-slate-500">
        Pendientes (email verificado), aprobados o todos. Máx 100 por vista.
      </p>

      <div className="flex gap-2 flex-wrap">
        <Link
          className={`px-3 py-1 rounded-lg border ${
            tab === "pending" ? "bg-slate-900 text-white" : "bg-white"
          }`}
          href="/admin/professionals?tab=pending"
        >
          Pendientes ({countPending})
        </Link>
        <Link
          className={`px-3 py-1 rounded-lg border ${
            tab === "approved" ? "bg-slate-900 text-white" : "bg-white"
          }`}
          href="/admin/professionals?tab=approved"
        >
          Aprobados ({countApproved})
        </Link>
        <Link
          className={`px-3 py-1 rounded-lg border ${
            tab === "all" ? "bg-slate-900 text-white" : "bg-white"
          }`}
          href="/admin/professionals?tab=all"
        >
          Todos ({countAll})
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 text-sm text-slate-600">
          {professionals.length} mostrado(s)
        </div>

        {professionals.length === 0 ? (
          <div className="p-6 text-slate-600">No hay resultados para este filtro.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {professionals.map((p) => {
              const u = p.user;
              const canApprove = u?.emailVerified && !p.isApproved;

              return (
                <li key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-slate-800">
                          {u?.name || "(Sin nombre)"}
                        </div>
                        {u?.emailVerified ? (
                          <Pill tone="green">Email verificado</Pill>
                        ) : (
                          <Pill tone="yellow">Email NO verificado</Pill>
                        )}
                        {p.isApproved ? <Pill tone="blue">Aprobado</Pill> : <Pill tone="red">Pendiente</Pill>}
                      </div>

                      <div className="text-slate-600 text-sm">
                        <div><b>Especialidad:</b> {p.specialty}</div>
                        {p.licenseNumber ? <div><b>Mat:</b> {p.licenseNumber}</div> : null}
                        <div><b>Email:</b> {u?.email}</div>
                        {u?.phone ? <div><b>Tel:</b> {u.phone}</div> : null}
                        <div className="text-xs text-slate-500">
                          Alta: {formatDateTime(new Date(p.createdAt))}
                        </div>
                      </div>

                      <div className="flex gap-3 text-sm flex-wrap pt-1">
                        {p.avatarUrl ? (
                          <a className="text-blue-600 hover:underline" href={p.avatarUrl} target="_blank" rel="noreferrer">
                            Ver foto
                          </a>
                        ) : (
                          <span className="text-slate-400">Sin foto</span>
                        )}
                        {p.cvUrl ? (
                          <a className="text-blue-600 hover:underline" href={p.cvUrl} target="_blank" rel="noreferrer">
                            Ver CV
                          </a>
                        ) : (
                          <span className="text-slate-400">Sin CV</span>
                        )}
                        <Link className="text-blue-600 hover:underline" href={`/admin/professionals/${p.id}`}>
                          Ver detalle
                        </Link>
                      </div>

                      {!u?.emailVerified && !p.isApproved ? (
                        <div className="text-xs text-amber-700 mt-2">
                          No se puede aprobar hasta que verifique su email.
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      {canApprove ? (
                        <AdminApproveButton
                          endpoint={`/api/admin/professionals/${p.id}/approve`}
                          label="Aprobar"
                        />
                      ) : p.isApproved ? (
                        <span className="text-xs text-slate-500">Ya aprobado</span>
                      ) : (
                        <span className="text-xs text-slate-500">No aprobable</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
