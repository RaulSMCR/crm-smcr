// src/app/admin/page.js
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import AdminApproveButton from '@/components/AdminApproveButton';

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export const revalidate = 0; // mostrar siempre datos frescos en dev

export default async function AdminPage() {
  // Profesionales pendientes (isApproved = false)
  const pendingProfessionals = await prisma.professional.findMany({
    where: { isApproved: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      createdAt: true,
    },
  });

  // Posts pendientes (status = 'PENDING')
  const pendingPosts = await prisma.post.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      postType: true,
      author: { select: { id: true, name: true, profession: true } },
      service: { select: { id: true, slug: true, title: true } },
    },
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Panel de Moderación</h1>

      {/* Profesionales pendientes */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold">Profesionales en espera</h2>
          <span className="text-sm text-gray-500">
            {pendingProfessionals.length} pendiente(s)
          </span>
        </div>

        {pendingProfessionals.length === 0 ? (
          <p className="text-gray-600">No hay profesionales para aprobar.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pendingProfessionals.map((pro) => (
              <li key={pro.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{pro.name}</div>
                  <div className="text-sm text-gray-600">{pro.profession}</div>
                  <div className="text-sm text-gray-500">{pro.email}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Alta: {formatDate(new Date(pro.createdAt))}
                  </div>
                </div>
                <AdminApproveButton
                  label="Aprobar profesional"
                  endpoint={`/api/admin/professionals/${pro.id}/approve`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Posts pendientes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold">Artículos en revisión</h2>
          <span className="text-sm text-gray-500">
            {pendingPosts.length} pendiente(s)
          </span>
        </div>

        {pendingPosts.length === 0 ? (
          <p className="text-gray-600">No hay artículos para publicar.</p>
        ) : (
          <ul className="space-y-4">
            {pendingPosts.map((p) => (
              <li key={p.id} className="border rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-sm text-gray-600">
                      Autor: {p.author?.name ?? '—'}
                      {p.author?.profession ? ` · ${p.author.profession}` : ''}
                      {' · '}
                      {p.postType}
                      {' · '}
                      {formatDate(new Date(p.createdAt))}
                    </div>
                    {p.service ? (
                      <div className="text-sm">
                        Servicio:{' '}
                        <Link className="text-blue-600 underline" href={`/servicios/${p.service.slug}`}>
                          {p.service.title}
                        </Link>
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-500 mt-1">Slug: {p.slug}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/blog/${p.slug}`}
                      className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                      prefetch={false}
                      target="_blank"
                    >
                      Previsualizar
                    </Link>
                    <AdminApproveButton
                      label="Publicar"
                      endpoint={`/api/admin/posts/${p.id}/approve`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
