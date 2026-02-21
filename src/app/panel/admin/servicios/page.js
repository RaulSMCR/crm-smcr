// src/app/panel/admin/servicios/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function AdminServiciosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const services = await prisma.service.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      isActive: true,
      durationMin: true,
      price: true,
      // Total profesionales vinculados al servicio
      _count: { select: { professionals: true } },
      // Profesionales "válidos" (aprobados + usuario activo) para contar “aprobados”
      professionals: {
        where: {
          isApproved: true,
          user: { is: { isActive: true } },
        },
        select: { id: true },
      },
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Servicios</h1>
          <p className="text-slate-600 mt-2">
            Administración de servicios y profesionales vinculados (modelo M2M).
          </p>
        </div>

        <Link
          href="/panel/admin"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
        >
          Volver al panel
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-sm text-slate-700">
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Act.</th>
              <th className="px-4 py-3">Profesionales</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>

          <tbody>
            {services.map((s) => {
              const priceStr = s.price?.toString?.() ?? String(s.price);
              const total = s._count.professionals;
              const approved = s.professionals.length;

              return (
                <tr key={s.id} className="border-t border-slate-200 text-sm">
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.title}</td>
                  <td className="px-4 py-3 text-slate-700">{s.durationMin} min</td>
                  <td className="px-4 py-3 text-slate-700">₡{priceStr}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        s.isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {s.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {approved} aprob. / {total} total
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/panel/admin/servicios/${s.id}`}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              );
            })}

            {services.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-600" colSpan={6}>
                  No hay servicios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Nota: En este esquema no existe “asignación con estado”. Solo vínculo M2M entre servicios y
        profesionales.
      </div>
    </div>
  );
}