// src/app/perfil/[id]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

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
      profession: true,
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
        where: { status: 'PUBLISHED' }, // schema transición: string
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          createdAt: true,
          imageUrl: true,
          postType: true,
          service: { select: { slug: true, title: true } },
        },
      },
    },
  });
  return professional;
}

export default async function ProfessionalProfilePage({ params }) {
  const id = Number(params?.id);
  if (!Number.isInteger(id)) notFound();

  const pro = await getProfessional(id);
  if (!pro) notFound();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center gap-6 mb-10">
        <div className="w-28 h-28 rounded-full bg-gray-100 overflow-hidden">
          {pro.avatarUrl ? (
            <img src={pro.avatarUrl} alt={pro.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
              {pro.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{pro.name}</h1>
          <p className="text-gray-600">{pro.profession}</p>

          <div className="mt-2">
            {pro.isApproved ? (
              <span className="text-xs inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded">
                ✓ Perfil verificado
              </span>
            ) : (
              <span className="text-xs inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded">
                ⚠ En revisión
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/perfil/${pro.id}/calendar`}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Agendar cita
            </Link>

            {pro.paymentLinkBase ? (
              <a
                href={pro.paymentLinkBase}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Generar enlace de pago
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Intro video opcional */}
      {pro.introVideoUrl ? (
        <section className="mb-10">
          <div className="aspect-video w-full rounded-xl overflow-hidden border">
            <iframe
              src={pro.introVideoUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Presentación de ${pro.name}`}
            />
          </div>
        </section>
      ) : null}

      {/* Bio */}
      {pro.bio ? (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-3">Sobre mí</h2>
          <div className="prose max-w-none">
            <p style={{ whiteSpace: 'pre-wrap' }}>{pro.bio}</p>
          </div>
        </section>
      ) : null}

      {/* Servicios del profesional */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Servicios</h2>
        {pro.services.length === 0 ? (
          <p className="text-gray-600">Aún no hay servicios vinculados.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {pro.services.map((s) => (
              <li key={s.id} className="border rounded-lg p-4 hover:shadow">
                <Link href={`/servicios/${s.slug}`} className="block">
                  {s.imageUrl ? (
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      className="w-full h-40 object-cover rounded-md mb-3"
                    />
                  ) : null}
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Últimos artículos publicados */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Artículos recientes</h2>
        {pro.posts.length === 0 ? (
          <p className="text-gray-600">Este profesional aún no tiene artículos publicados.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {pro.posts.map((p) => (
              <li key={p.id} className="border rounded-lg p-4 hover:shadow">
                <Link href={`/blog/${p.slug}`} className="block">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-40 object-cover rounded-md mb-3"
                    />
                  ) : null}
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(new Date(p.createdAt))} · {p.postType}
                    {p.service ? (
                      <>
                        {' · Servicio: '}
                        <Link
                          className="text-blue-600 underline"
                          href={`/servicios/${p.service.slug}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.service.title}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
