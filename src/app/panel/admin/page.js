// src/app/panel/admin/page.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions"; // 👈 CORRECCIÓN: Usamos la ruta segura
import { redirect } from "next/navigation";
import Link from "next/link";
import PendingProfessionalsList from "@/components/admin/PendingProfessionalsList";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // 1. Obtener Sesión de forma segura
  const session = await getSession();

  // 2. Validación de Seguridad
  if (!session || session.role !== 'ADMIN') {
    redirect('/ingresar');
  }

  // 3. Obtener Datos (Protegido con Try/Catch por si falla la DB)
  let pendingCount = 0;
  let postsPendingCount = 0;
  let servicesCount = 0;
  let pendingUsers = [];

  try {
    [pendingCount, postsPendingCount, servicesCount, pendingUsers] = await Promise.all([
        prisma.user.count({ where: { role: 'PROFESSIONAL', isApproved: false } }),
        prisma.post.count({ where: { published: false } }),
        prisma.service.count({ where: { isActive: true } }),
        prisma.user.findMany({
            where: { role: 'PROFESSIONAL', isApproved: false },
            include: { professionalProfile: true }
        })
    ]);
  } catch (error) {
    console.error("Error cargando datos del admin:", error);
    // No bloqueamos la página, mostramos datos vacíos si falla la DB
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Panel de Administración</h1>
                <p className="text-slate-500 text-sm">Visión general del sistema.</p>
            </div>
            <div className="flex gap-2">
                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-300">
                    Modo Administrador
                </span>
            </div>
        </div>

        {/* CENTRO DE COMANDO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Link href="/panel/admin/servicios" className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-blue-500">🏷️</div>
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
                        🏥
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                        {servicesCount} Activos
                    </span>
                </div>
                <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Catálogo de Servicios</h3>
                <p className="text-sm text-slate-500 mt-1">Gestiona precios y terapias.</p>
            </Link>

            <Link href="/panel/admin/blog" className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 text-6xl text-purple-500">✍️</div>
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                        📰
                    </div>
                    {postsPendingCount > 0 && (
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                            {postsPendingCount} por revisar
                        </span>
                    )}
                </div>
                <h3 className="font-bold text-slate-800 group-hover:text-purple-600 transition-colors">Gestión Editorial</h3>
                <p className="text-sm text-slate-500 mt-1">Modera el blog.</p>
            </Link>

            <div className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 opacity-60">
                <div className="h-12 w-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center text-2xl mb-4">
                    📊
                </div>
                <h3 className="font-bold text-slate-500">Analíticas</h3>
                <p className="text-sm text-slate-400 mt-1">Próximamente.</p>
            </div>
        </div>

        {/* LISTA DE PENDIENTES */}
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Solicitudes de Ingreso</h2>
            {/* Si el componente falla, al menos sabremos que el resto funciona */}
            <PendingProfessionalsList users={pendingUsers} />
        </div>

      </div>
    </div>
  );
}