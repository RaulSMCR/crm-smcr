// src/app/panel/profesional/page.js
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";

function formatDateTime(d) {
  try {
    return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return String(d);
  }
}

export default async function ProfesionalDashboardPage() {
  const session = await getSession();

  if (!session?.user?.id) redirect("/ingresar");
  if (session.user.role !== "PROFESSIONAL") redirect("/");

  const now = new Date();

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,

      // ✅ Antes tenías `services: true` (NO existe).
      // Prisma te indica que el campo real es `serviceAssignments`.
      serviceAssignments: {
        include: {
          service: true, // para poder leer title/isActive/durationMin/price etc.
        },
      },

      _count: {
        select: {
          posts: true,
          appointments: true,
        },
      },

      appointments: {
        where: {
          date: { gte: now },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { date: "asc" },
        take: 5,
        include: {
          patient: { select: { name: true } },
          service: { select: { title: true } },
        },
      },
    },
  });

  // Si el profesional todavía no tiene perfil (o está en onboarding), mandalo a su perfil / espera
  if (!profile) redirect("/espera-aprobacion");

  const assignedServices = (profile.serviceAssignments || [])
    .map((sa) => sa.service)
    .filter(Boolean);

  const activeAssignedServices = assignedServices.filter((s) => s.isActive);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">
          Panel Profesional
        </h1>
        <p className="text-slate-500">
          Hola, <span className="font-medium text-slate-700">{profile.user?.name || "Profesional"}</span>.
          Aquí tenés un resumen de tu actividad.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Servicios asignados</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">
            {assignedServices.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Activos: {activeAssignedServices.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Citas (total)</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">
            {profile._count?.appointments ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Próximas: {profile.appointments?.length ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Publicaciones</div>
          <div className="mt-1 text-3xl font-bold text-slate-800">
            {profile._count?.posts ?? 0}
          </div>
          <div className="mt-2">
            <Link
              href="/panel/profesional/editar-articulo"
              className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-3 py-1 hover:bg-slate-50"
            >
              Crear / editar artículo
            </Link>
          </div>
        </div>
      </div>

      {/* Servicios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Mis servicios</h2>
            <p className="text-sm text-slate-500">Servicios vinculados a tu perfil.</p>
          </div>
          <Link
            href="/panel/profesional/perfil"
            className="text-sm inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            Editar perfil
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-6 py-3 font-semibold">Título</th>
                <th className="px-6 py-3 font-semibold">Estado</th>
                <th className="px-6 py-3 font-semibold">Duración</th>
                <th className="px-6 py-3 font-semibold">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedServices.length === 0 ? (
                <tr>
                  <td className="px-6 py-5 text-slate-500" colSpan={4}>
                    Aún no tenés servicios asignados.
                  </td>
                </tr>
              ) : (
                assignedServices.map((s) => (
                  <tr key={s.id} className="text-slate-800">
                    <td className="px-6 py-4 font-medium">{s.title}</td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">{s.durationMin ? `${s.durationMin} min` : "-"}</td>
                    <td className="px-6 py-4">
                      {s.price != null ? Number(s.price).toLocaleString("es-CR") : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Próximas citas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Próximas citas</h2>
            <p className="text-sm text-slate-500">Pendientes o confirmadas.</p>
          </div>
          <Link
            href="/panel/profesional/citas"
            className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50"
          >
            Ver todas
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {(profile.appointments || []).length === 0 ? (
            <div className="px-6 py-5 text-slate-500">No tenés citas próximas.</div>
          ) : (
            profile.appointments.map((a) => (
              <div key={a.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-800">
                    {a.service?.title || "Servicio"} · {a.patient?.name || "Paciente"}
                  </div>
                  <div className="text-sm text-slate-500">{formatDateTime(a.date)}</div>
                </div>
                <div className="text-xs">
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-slate-700 font-semibold border border-slate-200">
                    {a.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/panel/profesional/horarios"
          className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50"
        >
          Gestionar horarios
        </Link>
        <Link
          href="/panel/profesional/integraciones"
          className="text-sm inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-50"
        >
          Integraciones
        </Link>
      </div>
    </div>
  );
}