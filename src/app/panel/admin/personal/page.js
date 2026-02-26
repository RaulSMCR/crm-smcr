// src/app/panel/admin/personal/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";

export default async function AdminPersonalPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const professionals = await prisma.professionalProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      specialty: true,
      isApproved: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      serviceAssignments: {
        orderBy: { service: { title: "asc" } },
        select: {
          status: true,
          service: {
            select: { id: true, title: true, isActive: true },
          },
        },
      },
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Personal (Profesionales)</h1>
          <p className="text-slate-600 mt-2">
            Vista administrativa de profesionales y servicios vinculados (M2M).
          </p>
        </div>

        <Link
          href="/panel/admin"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
        >
          Volver al panel
        </Link>
      </div>

      <div className="space-y-4">
        {professionals.map((p) => {
          const approvedServices = p.serviceAssignments.filter(
            (assignment) => assignment.status === "APPROVED",
          );

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-lg font-bold text-slate-900">{p.user?.name}</div>
                  <div className="text-sm text-slate-600">
                    {p.specialty} · {p.user?.email} · {p.user?.phone}
                  </div>

                  <div className="mt-3 flex gap-2 items-center">
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

                    <span className="text-xs text-slate-500">
                      Servicios aprobados: <b>{approvedServices.length}</b>
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-500 whitespace-nowrap">
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-slate-800">Servicios</div>
                {approvedServices.length === 0 ? (
                  <p className="text-sm text-slate-600 mt-2">Sin servicios vinculados.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {approvedServices.map(({ service }) => (
                      <span
                        key={service.id}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                          service.isActive
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                            : "bg-slate-50 text-slate-800 border-slate-200"
                        }`}
                      >
                        {service.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {professionals.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-700">
            No hay profesionales.
          </div>
        )}
      </div>
    </div>
  );
}
