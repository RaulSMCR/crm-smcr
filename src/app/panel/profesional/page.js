//src/app/panel/profesional/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, logout } from "@/actions/auth-actions";
import { getProfessionalAppointments } from "@/actions/agenda-actions";
import { prisma } from "@/lib/prisma"; // Necesario solo si traemos los artículos aquí directo

// Componentes Nuevos
import DashboardNav from "@/components/DashboardNav";
import ProfessionalAppointmentsPanel from "@/components/ProfessionalAppointmentsPanel";
import GoogleConnectButton from "@/components/admin/GoogleConnectButton";

// Asegura que la página siempre muestre datos frescos
export const dynamic = 'force-dynamic';

export default async function ProfesionalDashboardPage() {
  // 1. Verificación de Sesión y Rol (Seguridad)
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/ingresar");
  }

  if (session.role !== "PROFESSIONAL") {
    // Si es paciente, lo mandamos a su panel correcto
    redirect("/panel/paciente");
  }

  const professionalId = session.profile.id;

  // 2. Carga de Datos en Paralelo (Agenda + Blog)
  // Usamos Promise.all para que sea instantáneo
  const [appointments, myPosts] = await Promise.all([
    // A. Agenda (Usando la Server Action unificada)
    getProfessionalAppointments(professionalId),
    
    // B. Blog (Consulta directa optimizada para Server Component)
    prisma.post.findMany({
      where: { authorId: professionalId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { service: { select: { title: true } } }
    })
  ]);

  return (
    <div className="bg-gray-50 py-12 min-h-screen">
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Panel Profesional</h1>
            <p className="text-lg text-gray-600">
              Bienvenido, {session.profile.name}
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
             {/* Botón Logout (Server Action) */}
             <form action={logout}>
                <button type="submit" className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors shadow-sm">
                  Cerrar Sesión
                </button>
             </form>
          </div>
        </div>

        {/* NAVEGACIÓN Y CONEXIÓN GOOGLE */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-3">
                 <DashboardNav />
            </div>
            {/* Tarjeta de Estado de Integración */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center items-center gap-2">
                 <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sincronización</p>
                 <GoogleConnectButton />
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA IZQUIERDA (2/3): AGENDA INTERACTIVA */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Gestión de Citas</h2>
                    {/* Botón de configuración de horarios (Ruta actualizada) */}
                    <Link href="/panel/profesional/horarios" className="text-sm text-blue-600 hover:underline font-medium">
                        Configurar Disponibilidad &rarr;
                    </Link>
                </div>

                {/* EL NUEVO COMPONENTE POTENTE */}
                <ProfessionalAppointmentsPanel initialAppointments={appointments} />
            </div>

            {/* COLUMNA DERECHA (1/3): BLOG RÁPIDO */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Mis Artículos</h2>
                    <Link href="/panel/profesional/editar-articulo/new" className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors">
                        + Nuevo
                    </Link>
                </div>

                {/* Lista Simple de Artículos */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {myPosts.length > 0 ? (
                        <ul className="divide-y divide-gray-100">
                            {myPosts.map(post => (
                                <li key={post.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <Link href={`/panel/profesional/editar-articulo/${post.id}`} className="block group">
                                        <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                            {post.title}
                                        </h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                post.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {post.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                                            </span>
                                            <span className="text-xs text-gray-400">Editar &rarr;</span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No has escrito artículos aún.
                        </div>
                    )}
                    <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                        <Link href="/panel/profesional/articulos" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
                            Ver todos mis artículos
                        </Link>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}