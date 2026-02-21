// src/app/panel/admin/servicios/[id]/page.js
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function AdminServicioDetallePage({ params }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const serviceId = String(params?.id || "");
  if (!serviceId) notFound();

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      durationMin: true,
      isActive: true,
      professionals: {
        orderBy: { user: { name: "asc" } },
        select: {
          id: true,
          specialty: true,
          isApproved: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!service) notFound();

  const priceStr = service.price?.toString?.() ?? String(service.price);

  const approvedCount = service.professionals.filter(
    (p) => p.isApproved && p.user?.isActive
  ).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-sm text-slate-600">
            <Link href="/panel/admin/servicios" className="hover:underline">
              ← Volver a servicios
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mt-2">{service.title}</h1>

          <div className="text-sm text-slate-700 mt-3">
            <b>Duración:</b> {service.durationMin} min · <b>Precio:</b> ₡{priceStr} ·{" "}
            <b>Estado:</b> {service.isActive ? "Activo" : "Inactivo"}
          </div>

          {service.description ? (
            <p className="text-slate-700 mt-4">{service.description}</p>
          ) : (
            <p className="text-slate-500 mt-4">Sin descripción.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Profesionales vinculados</h2>
            <p className="text-sm text-slate-600 mt-1">
              Aprobados y activos: <b>{approvedCount}</b> · Total vinculados:{" "}
              <b>{service.professionals.length}</b>
            </p>
          </div>
        </div>

        {service.professionals.length === 0 ? (
          <p className="mt-4 text-slate-700">No hay profesionales vinculados a este servicio.</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr className="text-sm text-slate-700">
                  <th className="px-4 py-3">Profesional</th>
                  <th className="px-4 py-3">Especialidad</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {service.professionals.map((p) => (
                  <tr key={p.id} className="border-t border-slate-200 text-sm">
                    <td className="px-4 py-3 font-semibold text-slate-900">{p.user?.name}</td>
                    <td className="px-4 py-3 text-slate-700">{p.specialty}</td>
                    <td className="px-4 py-3 text-slate-700">{p.user?.email}</td>
                    <td className="px-4 py-3 text-slate-700">{p.user?.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            p.isApproved
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {p.isApproved ? "Aprobado" : "Pendiente"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            p.user?.isActive
                              ? "bg-slate-50 text-slate-800 border border-slate-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {p.user?.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500">
          Nota: ya no existe `professionalAssignments` en Prisma; en este modelo el vínculo es
          directo M2M.
        </div>
      </div>
    </div>
  );
}