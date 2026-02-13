// src/app/panel/admin/page.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import PendingProfessionalsList from "@/components/admin/PendingProfessionalsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const session = await getSession();

  // 1. Seguridad
  if (!session || session.role !== "ADMIN") {
    redirect("/ingresar");
  }

  // Helpers de filtros (evita repetir lógica y errores)
  const wherePendingProsUsers = {
    role: "PROFESSIONAL",
    professionalProfile: {
      is: { isApproved: false },
    },
  };

  const whereApprovedProsUsers = {
    role: "PROFESSIONAL",
    professionalProfile: {
      is: { isApproved: true },
    },
  };

  // 2. Obtener Datos Clave (sin usar User.isApproved porque ya no existe)
  const [pendingCount, postsPendingCount, servicesCount, professionalsCount, pendingUsers] =
    await Promise.all([
      // A. Profesionales pendientes de aprobación
      prisma.user.count({ where: wherePendingProsUsers }),

      // B. Posts en estado 'DRAFT'
      prisma.post.count({ where: { status: "DRAFT" } }),

      // C. Servicios activos
      prisma.service.count({ where: { isActive: true } }),

      // D. Profesionales activos/aprobados
      prisma.user.count({ where: whereApprovedProsUsers }),

      // E. Lista de usuarios pendientes (incluye el perfil)
      prisma.user.findMany({
        where: wherePendingProsUsers,
        include: { professionalProfile: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ENCABEZADO */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Panel de Administración
            </h1>
            <p className="text-slate-500 text-sm">Torre de control del sistema.</p>
          </div>
          <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-300">
            Modo Administrador
          </span>
        </div>

        {/* CENTRO DE COMANDO (GRID DE 4 MÓDULOS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. SERVICIOS */}
          <Link
            href="/panel/admin/servicios"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-blue-500">
              🏷️
            </div>
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
                🏥
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                {servicesCount}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 group-hover:text-blue-600">
              Servicios
            </h3>
            <p className="text-xs text-slate-500 mt-1">Catálogo de terapias.</p>
          </Link>

          {/* 2. BLOG */}
          <Link
            href="/panel/admin/blog"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-purple-500">
              ✍️
            </div>
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                📰
              </div>
              {postsPendingCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                  {postsPendingCount} rev.
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 group-hover:text-purple-600">
              Editorial
            </h3>
            <p className="text-xs text-slate-500 mt-1">Gestión del blog.</p>
          </Link>

          {/* 3. PERSONAL (RRHH) */}
          <Link
            href="/panel/admin/personal"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-orange-400 hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-orange-500">
              👥
            </div>
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-2xl">
                📇
              </div>
              <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                {professionalsCount}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 group-hover:text-orange-600">
              Personal
            </h3>
            <p className="text-xs text-slate-500 mt-1">Directorio médico.</p>
          </Link>

          {/* 4. CONTABILIDAD */}
          <Link
            href="/panel/admin/contabilidad"
            className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-green-400 hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-green-500">
              💰
            </div>
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl">
                📊
              </div>
            </div>
            <h3 className="font-bold text-slate-800 group-hover:text-green-600">
              Contabilidad
            </h3>
            <p className="text-xs text-slate-500 mt-1">Ingresos y reportes.</p>
          </Link>
        </div>

        {/* LISTA DE PENDIENTES */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Solicitudes de Ingreso</h2>
            {pendingCount > 0 ? (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                {pendingCount} pendientes
              </span>
            ) : (
              <span className="text-slate-400 text-sm font-normal">(Todo al día)</span>
            )}
          </div>

          <PendingProfessionalsList users={pendingUsers} />
        </div>
      </div>
    </div>
  );
}
