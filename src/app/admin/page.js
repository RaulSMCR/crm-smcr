// src/app/admin/page.js
// src/app/admin/page.js
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard Administrativo | CRM SMCR",
};

export default async function AdminDashboardPage() {
  const [totalUsers, totalPros, pendingProsCount, upcomingAppointments] =
    await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.professionalProfile.count(),
      prisma.professionalProfile.count({ where: { isApproved: false } }),
      prisma.appointment.count({
        where: {
          date: { gte: new Date() },
        },
      }),
    ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-slate-800">Panel de Control</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-slate-500 text-sm">Total Pacientes</div>
          <div className="text-3xl font-bold">{totalUsers}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-slate-500 text-sm">Profesionales</div>
          <div className="text-3xl font-bold">{totalPros}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-slate-500 text-sm">Solicitudes Pendientes</div>
          <div className="text-3xl font-bold">{pendingProsCount}</div>
          <div className="mt-2">
            <Link
              className="text-blue-600 hover:underline text-sm"
              href="/admin/professionals?tab=pending"
            >
              Revisar solicitudes
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-slate-500 text-sm">Citas Futuras</div>
          <div className="text-3xl font-bold">{upcomingAppointments}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 mb-2">Accesos Rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/professionals?tab=pending"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            Revisar Solicitudes ({pendingProsCount})
          </Link>
        </div>
      </div>
    </div>
  );
}
