//src/app/panel/profesional/page.js
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth'; // <--- Usamos el estándar del proyecto
import CancelAppointmentButton from '@/components/CancelAppointmentButton';

export const revalidate = 0; // Datos siempre frescos

// Helper para formatear fechas
function fmtDateTime(dt) {
  if (!dt) return 'Fecha inválida';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default async function DashboardProfesionalPage() {
  // 1. Auth Check (Estandarizado)
  const session = await getSession();

  if (!session || session.role !== 'PROFESSIONAL') {
    redirect('/ingresar');
  }

  // 2. OBTENER EL ID DEL PERFIL (Crítico)
  // En nuestro nuevo JWT (auth-actions.js), ya guardamos el professionalId.
  // Si por alguna razón la cookie es vieja y no lo tiene, lo buscamos en la DB.
  let professionalId = session.professionalId;

  if (!professionalId) {
    const profile = await prisma.professionalProfile.findUnique({
        where: { userId: session.sub }
    });
    if (!profile) return <div className="p-10">Error: No tienes un perfil profesional creado.</div>;
    professionalId = profile.id;
  }

  // 3. Definir rango de tiempo (Próximos 14 días)
  const now = new Date();
  const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // 4. Consultas a la Base de Datos
  const [appointments, myPosts, availability] = await Promise.all([
    // A. Citas (Usando professionalId del PERFIL)
    prisma.appointment.findMany({
      where: {
        professionalId: professionalId, // <--- ID del Perfil
        status: { not: 'CANCELLED_BY_PRO' }, // Ajustado al Enum nuevo (revisa si quieres filtrar también CANCELLED_BY_USER)
        date: { gte: now, lte: until },
      },
      orderBy: { date: 'asc' },
      include: {
        patient: { // <--- CORRECCIÓN: La relación ahora se llama 'patient'
            select: { name: true, email: true, phone: true } 
        },
        service: { select: { title: true } }
      },
    }),
    
    // B. Publicaciones (Usando authorId que es el ID del Perfil)
    prisma.post.findMany({
      where: { authorId: professionalId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      // include: { service: ... } // Nota: Post ya no tiene relación directa con service en el último schema, lo comentamos para evitar error.
    }),

    // C. Disponibilidad
    prisma.availability.findMany({
      where: { professionalId: professionalId },
      take: 1 
    })
  ]);

  const hasAvailability = availability.length > 0;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel del Profesional</h1>
          <p className="text-gray-500 text-sm">Bienvenido, gestiona tus citas y contenido.</p>
        </div>
        
        <Link
          href="/admin/posts/new" 
          // OJO: Antes tenías /panel/profesional/editar-articulo/new. 
          // Si esa ruta existe, úsala. Si usas la de admin, cámbialo.
          // Asumiré que mantienes tu estructura de carpetas:
          // href="/panel/profesional/editar-articulo/new"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-center font-medium shadow-sm transition-colors"
        >
          + Nuevo artículo
        </Link>
      </header>

      {/* --- ALERTA DE CONFIGURACIÓN --- */}
      <section className={`p-6 rounded-lg border ${hasAvailability ? 'bg-white border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {hasAvailability ? "🗓️ Tu Agenda" : "⚠️ Configuración Pendiente"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {hasAvailability 
                ? "Tus horarios están activos. Los pacientes pueden encontrarte." 
                : "Aún no has definido tus horarios de atención. Tu perfil no permitirá reservas hasta que lo hagas."}
            </p>
          </div>
          
          <Link
            href="/panel/profesional/horarios"
            className={`px-5 py-2.5 rounded font-medium text-sm transition-colors ${
              hasAvailability 
                ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" 
                : "bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
            }`}
          >
            {hasAvailability ? "Gestionar Horarios" : "Configurar Horarios Ahora"}
          </Link>
        </div>
      </section>

      {/* SECCIÓN 1: PRÓXIMAS CITAS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Próximas Citas</h2>
        </div>

        {appointments.length === 0 ? (
          <div className="bg-white border border-dashed rounded-lg p-8 text-center text-gray-500">
            No tienes citas programadas para los próximos 14 días.
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <ul className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <li key={a.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  {/* Info Cita */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg text-blue-900">
                          {fmtDateTime(new Date(a.date))}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-medium">
                        {a.status}
                      </span>
                    </div>
                    
                    {/* CORRECCIÓN: Usamos a.patient en lugar de a.user */}
                    <div className="text-gray-900 font-medium">
                      {a.patient?.name || 'Paciente sin nombre'}
                    </div>
                    
                    <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                      <span>{a.patient?.email}</span>
                      {a.patient?.phone && <span>📞 {a.patient.phone}</span>}
                    </div>

                    {a.service && (
                      <div className="text-sm text-gray-600 mt-1">
                        Servicio: <span className="font-medium">{a.service.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex-shrink-0">
                    <CancelAppointmentButton 
                      professionalId={professionalId} 
                      appointmentId={a.id} 
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: TUS ARTÍCULOS */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tus Últimos Artículos</h2>
        
        {myPosts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-600 mb-2">Aún no has publicado contenido.</p>
            {/* Si tienes una página específica para editar artículos en el panel, úsala aquí */}
            <Link href="/panel/profesional/editar-articulo/new" className="text-blue-600 hover:underline text-sm">
              Escribir mi primer artículo
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myPosts.map((p) => (
              <article key={p.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-medium text-gray-900 truncate mb-1" title={p.title}>
                  {p.title}
                </h3>
                <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    p.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  {p.status}
                </div>
                
                <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                  <Link
                    href={`/panel/profesional/editar-articulo/${p.id}`}
                    className="flex-1 text-center py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border"
                  >
                    Editar
                  </Link>
                  {p.status === 'PUBLISHED' && (
                    <Link
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      className="flex-1 text-center py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100"
                    >
                      Ver
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}