// src/app/panel/admin/page.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; // Asegúrate de que la ruta sea correcta según tu proyecto
import { redirect } from "next/navigation";
import Link from "next/link";
import PendingProfessionalsList from "@/components/admin/PendingProfessionalsList";

// Forzar datos frescos siempre
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession();

  // 1. Seguridad
  if (!session || session.role !== 'ADMIN') {
    redirect('/ingresar');
  }

  // 2. Obtener Datos Clave (Solo lo necesario para el Dashboard)
  const [pendingCount, postsPendingCount, servicesCount, pendingUsers] = await Promise.all([
    // A. Cuántos profesionales esperan aprobación
    prisma.user.count({ where: { role: 'PROFESSIONAL', isApproved: false } }),
    
    // B. Cuántos posts están en borrador o sin revisar (opcional si usas 'published' false)
    prisma.post.count({ where: { published: false } }),
    
    // C. Total de servicios activos
    prisma.service.count({ where: { isActive: true } }),

    // D. La lista real de usuarios pendientes (para la tabla rápida)
    prisma.user.findMany({
      where: { role: 'PROFESSIONAL', isApproved: false },
      include: { professionalProfile: true }
    })
  ]);

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

        {/* 3. CENTRO DE COMANDO (GRID DE NAVEGACIÓN) */}
        {/* Aquí están los accesos a los módulos que creamos antes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* MÓDULO 1: SERVICIOS */}
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
                <p className="text-sm text-slate-500 mt-1">Crea, edita y asigna precios a las terapias.</p>
            </Link>

            {/* MÓDULO 2: BLOG / EDITORIAL */}
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
                <p className="text-sm text-slate-500 mt-1">Modera artículos y gestiona el blog.</p>
            </Link>

            {/* MÓDULO 3: MÉTRICAS / USUARIOS (Placeholder para futuro) */}
            <div className="group bg-white p-6 rounded-xl shadow-sm border border-slate-200 opacity-70">
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center text-2xl">
                        📊
                    </div>
                </div>
                <h3 className="font-bold text-slate-500">Analíticas Avanzadas</h3>
                <p className="text-sm text-slate-400 mt-1">Próximamente: Ingresos y reportes detallados.</p>
            </div>
        </div>

        {/* 4. ÁREA DE ACCIÓN URGENTE (Profesionales Pendientes) */}
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">Solicitudes de Ingreso</h2>
                {pendingCount > 0 ? (
                    <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                        {pendingCount} pendientes
                    </span>
                ) : (
                    <span className="text-slate-400 text-sm font-normal">(Todo al día)</span>
                )}
            </div>
            
            {/* Reutilizamos el componente de lista que arreglamos antes */}
            <PendingProfessionalsList users={pendingUsers} />
        </div>

      </div>
    </div>
  );
}