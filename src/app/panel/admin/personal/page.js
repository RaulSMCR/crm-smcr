// src/app/panel/admin/personal/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rejectUser } from "@/actions/admin-actions";

export const dynamic = "force-dynamic";

function startOfDayUTC(dateStr) {
  // dateStr: "YYYY-MM-DD"
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endExclusiveUTC(dateStr) {
  // devuelve el inicio del día siguiente (upper bound exclusivo)
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function computePresetRange(range) {
  const now = new Date();
  const toExclusive = now; // hasta "ahora"
  const from = new Date(now);

  if (range === "7d") {
    from.setDate(from.getDate() - 7);
    return { from, toExclusive, label: "Últimos 7 días" };
  }
  if (range === "30d") {
    from.setDate(from.getDate() - 30);
    return { from, toExclusive, label: "Últimos 30 días" };
  }
  if (range === "90d") {
    from.setDate(from.getDate() - 90);
    return { from, toExclusive, label: "Últimos 90 días" };
  }
  return { from: null, toExclusive: null, label: "Histórico (todo el tiempo)" };
}

export default async function AdminPersonnelPage({ searchParams }) {
  const range = typeof searchParams?.range === "string" ? searchParams.range : "all";
  const fromStr = typeof searchParams?.from === "string" ? searchParams.from : "";
  const toStr = typeof searchParams?.to === "string" ? searchParams.to : "";

  // Prioridad:
  // 1) Si el usuario define desde/hasta => usamos eso
  // 2) Si no, usamos preset (7d/30d/90d)
  // 3) Si no, histórico
  let from = null;
  let toExclusive = null;
  let rangeLabel = "Histórico (todo el tiempo)";
  let isRanged = false;

  if (fromStr || toStr) {
    // Si solo viene uno, completamos con límites razonables
    from = fromStr ? startOfDayUTC(fromStr) : new Date("1970-01-01T00:00:00.000Z");
    toExclusive = toStr ? endExclusiveUTC(toStr) : new Date(); // hasta ahora
    rangeLabel = `${fromStr || "Inicio"} → ${toStr || "Hoy"}`;
    isRanged = true;
  } else if (range !== "all") {
    const preset = computePresetRange(range);
    from = preset.from;
    toExclusive = preset.toExclusive;
    rangeLabel = preset.label;
    isRanged = true;
  }

  // Profesionales aprobados (isApproved = true)
  const professionals = await prisma.user.findMany({
    where: {
      role: "PROFESSIONAL",
      professionalProfile: { is: { isApproved: true } },
    },
    include: {
      professionalProfile: {
        include: {
          _count: {
            select: {
              appointments: true, // histórico
              posts: true,        // publicaciones totales
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Conteo por rango (sin N+1): groupBy en Appointment
  const apptCountByPro = Object.create(null);

  if (isRanged) {
    const proProfileIds = professionals
      .map((u) => u.professionalProfile?.id)
      .filter(Boolean);

    if (proProfileIds.length > 0) {
      const grouped = await prisma.appointment.groupBy({
        by: ["professionalId"],
        where: {
          professionalId: { in: proProfileIds },
          date: {
            gte: from,
            lt: toExclusive,
          },
          // Si querés excluir canceladas, descomentá:
          // status: { in: ["CONFIRMED", "COMPLETED"] },
        },
        _count: { _all: true },
      });

      for (const row of grouped) {
        apptCountByPro[row.professionalId] = row._count._all;
      }
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">Gestión de Personal</h1>
        <p className="text-slate-500">Directorio de profesionales aprobados en la plataforma.</p>
        <div className="text-sm text-slate-600">
          <span className="font-semibold">Total aprobados:</span> {professionals.length}
          <span className="mx-2">•</span>
          <span className="font-semibold">Rendimiento:</span> {rangeLabel}
        </div>
      </div>

      {/* Filtros de rendimiento (GET) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Rango</label>
            <select
              name="range"
              defaultValue={range}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Histórico</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Desde</label>
            <input
              type="date"
              name="from"
              defaultValue={fromStr}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Hasta</label>
            <input
              type="date"
              name="to"
              defaultValue={toStr}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
          >
            Aplicar
          </button>

          <Link
            href="/panel/admin/personal"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Limpiar
          </Link>

          <p className="text-xs text-slate-500 max-w-xl">
            Nota: si llenás “Desde/Hasta”, eso tiene prioridad sobre el preset.
          </p>
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="p-4">Profesional</th>
              <th className="p-4">Especialidad</th>
              <th className="p-4">Publicaciones</th>
              <th className="p-4">Rendimiento</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {professionals.map((pro) => {
              const profileId = pro.professionalProfile?.id;
              const postCount = pro.professionalProfile?._count?.posts ?? 0;

              const apptCountHistoric = pro.professionalProfile?._count?.appointments ?? 0;
              const apptCountRanged = profileId ? (apptCountByPro[profileId] ?? 0) : 0;
              const apptCount = isRanged ? apptCountRanged : apptCountHistoric;

              return (
                <tr key={pro.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">{pro.name}</div>
                    <div className="text-sm text-slate-500">{pro.email}</div>
                    <div className="text-sm text-slate-500">{pro.phone}</div>
                  </td>

                  <td className="p-4">
                    <div className="text-slate-800">
                      {pro.professionalProfile?.specialty || "Sin especialidad"}
                    </div>
                    <div className="text-sm text-slate-500">
                      Mat: {pro.professionalProfile?.licenseNumber || "-"}
                    </div>
                  </td>

                  <td className="p-4">
                    {profileId ? (
                      <Link
                        href={`/panel/admin/blog?authorId=${profileId}`}
                        className="text-sm font-medium text-blue-700 hover:underline"
                      >
                        Ver ({postCount})
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="inline-flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{apptCount}</span>
                      <span className="text-sm text-slate-500">citas</span>
                    </div>
                    {isRanged && (
                      <div className="text-xs text-slate-500 mt-1">{rangeLabel}</div>
                    )}
                  </td>

                  <td className="p-4">
                    <span
                      className={[
                        "inline-flex px-2 py-1 rounded-full text-xs font-semibold",
                        pro.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      ].join(" ")}
                    >
                      {pro.isActive ? "ACTIVO" : "SUSPENDIDO"}
                    </span>
                  </td>

                  <td className="p-4">
                    <form
                      action={async () => {
                        "use server";
                        await rejectUser(pro.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-semibold text-rose-700 hover:underline"
                      >
                        Dar de Baja
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}

            {professionals.length === 0 && (
              <tr>
                <td className="p-6 text-slate-500" colSpan={6}>
                  No hay profesionales aprobados en el sistema.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
