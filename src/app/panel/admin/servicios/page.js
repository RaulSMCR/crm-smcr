import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function moneyCRC(value) {
  if (value == null) return "-";
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return String(value);
  }
}

export default async function AdminServiciosPage() {
  let services = [];

  try {
    services = await prisma.service.findMany({
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        displayOrder: true,
        isActive: true,
        durationMin: true,
        price: true,
        _count: {
          select: {
            professionalAssignments: true,
            appointments: true,
          },
        },
      },
    });
  } catch (err) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <h1 className="text-3xl font-bold text-slate-800">Servicios</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error al cargar servicios desde Prisma. Revisa el log de Vercel/Node para el detalle.
        </p>
        <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
          {String(err?.message || err)}
        </pre>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Servicios</h1>
          <p className="text-slate-500">
            Lista de servicios y metricas basicas (asignaciones profesionales y citas).
          </p>
        </div>

        <Link
          href="/panel/admin/servicios/nuevo"
          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          Crear servicio
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-sm text-slate-600">
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Titulo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Duracion</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Asignaciones</th>
                <th className="px-4 py-3 font-semibold">Citas</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={8}>
                    No hay servicios todavia.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="text-slate-800">
                    <td className="px-4 py-3 font-mono text-xs">{s.displayOrder}</td>

                    <td className="px-4 py-3">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-slate-500">ID: {s.id}</div>
                    </td>

                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">{s.durationMin ? `${s.durationMin} min` : "-"}</td>

                    <td className="px-4 py-3">{moneyCRC(s.price)}</td>

                    <td className="px-4 py-3">{s._count?.professionalAssignments ?? 0}</td>

                    <td className="px-4 py-3">{s._count?.appointments ?? 0}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/panel/admin/servicios/${s.id}`}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                        >
                          Ver / Editar
                        </Link>

                        <Link
                          href={`/panel/admin/servicios/${s.id}/asignaciones`}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                        >
                          Asignaciones
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
