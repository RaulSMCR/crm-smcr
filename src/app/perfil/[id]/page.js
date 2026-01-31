// src/app/perfil/[id]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SmartScheduleButton from '@/components/SmartScheduleButton';
import ProtectedAction from '@/components/auth/ProtectedAction'; // Importamos el interceptor

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

async function getProfessional(id) {
  const professional = await prisma.professional.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      declaredJobTitle: true, // CORREGIDO: antes profession
      bio: true,
      avatarUrl: true,
      introVideoUrl: true,
      calendarUrl: true,
      paymentLinkBase: true,
      isApproved: true,
      services: {
        orderBy: { title: 'asc' },
        select: { id: true, slug: true, title: true, price: true, imageUrl: true },
      },
      posts: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          createdAt: true,
          imageUrl: true,
          postType: true,
        },
      },
    },
  });
  return professional;
}

export default async function ProfessionalProfilePage({ params }) {
  // CORREGIDO: Los IDs son Strings (CUID), no Numbers
  const { id } = await params;
  
  if (!id) notFound();

  const pro = await getProfessional(id);
  // Seguridad: Solo perfiles aprobados son públicos
  if (!pro || !pro.isApproved) notFound();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center gap-6 mb-10">
        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
          {pro.avatarUrl ? (
            <img src={pro.avatarUrl} alt={pro.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600 text-3xl font-bold">
              {pro.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{pro.name}</h1>
          <p className="text-blue-600 font-medium">{pro.declaredJobTitle}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {/* Botón de agendamiento envuelto en lógica de protección si fuera necesario */}
            <SmartScheduleButton professionalId={pro.id} />
            
            {pro.paymentLinkBase && (
              <a href={pro.paymentLinkBase} target="_blank" className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors">
                Realizar Pago
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-3 border-b pb-2">Trayectoria Profesional</h2>
        <p className="text-gray-600 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{pro.bio}</p>
      </section>

      {/* Servicios con validación de existencia */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Servicios Ofrecidos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {pro.services.map((s) => (
            <div key={s.id} className="border rounded-xl p-4 hover:border-blue-300 transition-all shadow-sm">
              <h3 className="font-bold text-gray-900">{s.title}</h3>
              <p className="text-blue-600 font-bold">${Number(s.price)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Artículos Protegidos */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Blog y Artículos</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {pro.posts.map((p) => (
            <ProtectedAction key={p.id}>
              <Link href={`/blog/${p.slug}`} className="block border rounded-xl p-4 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900 group-hover:text-blue-600">{p.title}</h3>
                <span className="text-xs text-gray-400">{formatDate(new Date(p.createdAt))}</span>
                <p className="text-blue-500 text-sm mt-2 font-medium">🔓 Leer más (Solo usuarios)</p>
              </Link>
            </ProtectedAction>
          ))}
        </div>
      </section>
    </main>
  );
}