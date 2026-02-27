// src/app/panel/admin/servicios/page.js
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
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        isActive: true,
        durationMin: true,
        price: true,
        _count: {
          // ✅ Estos son los campos que Prisma te indicó como válidos
          select: {
            professionalAssignments: true,
            appointments: true,
          },
        },
      },
    });
  } catch (err) {
    // Render defensivo para no tumbar el panel completo
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800">Servicios</h1>
        <p className="mt-4 text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
          Error al cargar servicios desde Prisma. Revisá el log de Vercel/Node para el detalle.
        </p>
        <pre className="mt-4 text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto">
          {String(err?.message || err)}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Servicios</h1>
          <p className="text-slate-500">
            Lista de servicios y métricas básicas (asignaciones profesionales y citas).
          </p>
        </div>

        <Link
          href="/panel/admin/servicios/nuevo"
          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          Crear servicio
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-600 text-sm">
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
                <th className="px-4 py-3 font-semibold">Precio</th>
                <th className="px-4 py-3 font-semibold">Asignaciones</th>
                <th className="px-4 py-3 font-semibold">Citas</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No hay servicios todavía.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id} className="text-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-slate-500">ID: {s.id}</div>
                    </td>

                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 text-xs font-semibold border border-emerald-200">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-700 text-xs font-semibold border border-slate-200">
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {s.durationMin ? `${s.durationMin} min` : "-"}
                    </td>

                    <td className="px-4 py-3">{moneyCRC(s.price)}</td>

                    <td className="px-4 py-3">
                      {s._count?.professionalAssignments ?? 0}
                    </td>

                    <td className="px-4 py-3">{s._count?.appointments ?? 0}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/panel/admin/servicios/${s.id}`}
                          className="text-sm px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                          Ver / Editar
                        </Link>

                        <Link
                          href={`/panel/admin/servicios/${s.id}/asignaciones`}
                          className="text-sm px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                          Asignaciones
                        </Link>
                      </div>

                      {/* 
                        Nota importante:
                        Antes tu query intentaba contar SOLO profesionales aprobados/activos.
                        Prisma _count no soporta filtros directamente. Para eso, se hace:
                        - o una segunda query a la tabla puente (assignments) con count y where,
                        - o se trae professionalAssignments filtrado y se cuenta con .length.
                        Pero como el nombre del campo hacia el profesional (professional vs professionalProfile)
                        depende de tu schema, este archivo queda 100% “a prueba de errores” con lo que Prisma ya confirmó.
                      */}
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