// src/app/dashboard-profesional/page.js
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import CancelAppointmentButton from '@/components/CancelAppointmentButton';

export const revalidate = 0;

function fmtDateTime(dt) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(dt);
  } catch {
    return dt.toISOString().replace('T', ' ').slice(0, 16);
  }
}

export default async function DashboardProfesionalPage() {
  // Auth (middleware ya protege, pero validamos igual)
  const token = cookies().get('sessionToken')?.value || '';
  const payload = await verifyToken(token).catch(() => null);
  if (!payload || payload.role !== 'PROFESSIONAL') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold">Acceso restringido</h1>
        <p className="text-gray-600">Necesitás iniciar sesión como profesional.</p>
      </main>
    );
  }
  const professionalId = Number(payload.userId);

  // Próximas citas (14 días)
  const now = new Date();
  const until = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [appointments, myPosts] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        professionalId,
        status: { not: 'CANCELLED' },
        startTime: { gte: now, lte: until },
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        service: { select: { id: true, slug: true, title: true } },
      },
    }),
    prisma.post.findMany({
      where: { authorId: professionalId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        service: { select: { slug: true, title: true } },
      },
    }),
  ]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel del Profesional</h1>
        <Link
          href="/dashboard-profesional/editar-articulo/new"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Nuevo artículo
        </Link>
      </header>

      {/* Agenda próxima */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Próximas citas (14 días)</h2>
          <Link
            href={`/perfil/${professionalId}/calendar`}
            className="text-sm text-blue-600 underline"
          >
            Ver calendario público →
          </Link>
        </div>

        {appointments.length === 0 ? (
          <p className="text-gray-600">Sin citas en los próximos días.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {appointments.map((a) => (
              <li key={a.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{fmtDateTime(new Date(a.startTime))}</div>
                  <div className="text-sm text-gray-600">
                    {a.user?.name ?? 'Usuario'} ({a.user?.email ?? '—'})
                    {a.user?.phone ? ` · ${a.user.phone}` : ''}
                  </div>
                  {a.service ? (
                    <div className="text-sm text-gray-700">
                      Servicio: {a.service.title}
                    </div>
                  ) : null}
                  <div className="text-xs text-gray-500">Estado: {a.status}</div>
                </div>
                <CancelAppointmentButton professionalId={professionalId} appointmentId={a.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tus artículos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Tus artículos</h2>
          <Link
            href="/dashboard-profesional/editar-articulo/new"
            className="text-sm text-blue-600 underline"
          >
            Crear nuevo →
          </Link>
        </div>

        {myPosts.length === 0 ? (
          <p className="text-gray-600">Aún no creaste artículos.</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-4">
            {myPosts.map((p) => (
              <li key={p.id} className="border rounded-lg p-4">
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-sm text-gray-600">
                  Estado: {p.status} {p.service ? `· ${p.service.title}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Link
                    href={`/dashboard-profesional/editar-articulo/${p.id}`}
                    className="px-3 py-1.5 rounded border hover:bg-gray-50 text-sm"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="px-3 py-1.5 rounded border hover:bg-gray-50 text-sm"
                    target="_blank"
                  >
                    Ver
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
