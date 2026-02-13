// src/app/panel/admin/page.js
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/ingresar");
  }

  // ✅ Profesionales pendientes: ahora se cuenta en ProfessionalProfile.isApproved
  const pendingProsCount = await prisma.professionalProfile.count({
    where: { isApproved: false },
  });

  // (Opcional) Pacientes activos
  const activeUsersCount = await prisma.user.count({
    where: { role: "USER", isActive: true },
  });

  // (Opcional) Total profesionales (perfil creado)
  const totalProsCount = await prisma.professionalProfile.count();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Panel Admin</h1>
        <p className="text-slate-500 mt-1">Resumen general del sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Profesionales pendientes" value={pendingProsCount} />
        <Card title="Pacientes activos" value={activeUsersCount} />
        <Card title="Total profesionales" value={totalProsCount} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800">Acciones rápidas</h2>
        <p className="text-slate-600 mt-2">
          Aprobá profesionales desde la sección correspondiente (si ya existe) o agregala.
        </p>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
    </div>
  );
}
