// src/app/servicios/[slug]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

function formatPrice(value) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `$ ${value}`;
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

async function getService(slug) {
  const service = await prisma.service.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
      professionals: {
        select: {
          id: true,
          name: true,
          profession: true,
          avatarUrl: true,
        },
        orderBy: { name: 'asc' },
      },
      posts: {
        where: { status: 'PUBLISHED' }, // schema de transición: string
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          postType: true,
          createdAt: true,
          author: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!service) return null;

  let related = [];
  if (service.category?.id) {
    related = await prisma.service.findMany({
      where: { categoryId: service.category.id, id: { not: service.id } },
      orderBy: { title: 'asc' },
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        imageUrl: true,
        price: true,
      },
    });
  }

  return { service, related };
}

export default async function ServiceDetailPage({ params }) {
  const slug = params?.slug;
  if (!slug) notFound();

  const data = await getService(slug);
  if (!data?.service) notFound();

  const { service, related } = data;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-4">
        <Link href="/servicios" className="text-sm text-blue-600 underline">
          ← Volver a servicios
        </Link>
      </div>

      <section className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{service.title}</h1>

        <div className="text-sm text-gray-500 mb-4">
          {service.category ? (
            <>
              Categoría:{' '}
              <Link
                className="text-blue-600 underline"
                href={`/servicios?categoria=${service.category.slug}`}
              >
                {service.category.name}
              </Link>
              {' · '}
            </>
          ) : null}
          Creado: {formatDate(new Date(service.createdAt))}
          {' · '}
          Actualizado: {formatDate(new Date(service.updatedAt))}
        </div>

        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.title}
            className="w-full h-72 object-cover rounded-xl mb-6"
          />
        ) : null}

        <div className="prose max-w-none">
          <p style={{ whiteSpace: 'pre-wrap' }}>{service.description}</p>
        </div>

        <div className="mt-6">
          <span className="inline-flex items-center rounded-lg border px-3 py-1 text-sm">
            Tarifa de referencia: <span className="font-semibold ml-2">{formatPrice(service.price)}</span>
          </span>
        </div>
      </section>

      {/* Profesionales que brindan este servicio */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Profesionales</h2>
        {service.professionals.length === 0 ? (
          <p className="text-gray-600">Aún no hay profesionales vinculados.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {service.professionals.map((pro) => (
              <li key={pro.id} className="border rounded-lg p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden">
                  {pro.avatarUrl ? (
                    <img
                      src={pro.avatarUrl}
                      alt={pro.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {pro.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{pro.name}</h3>
                  <p className="text-sm text-gray-500">{pro.profession}</p>
                  <div className="mt-2 flex gap-3">
                    <Link
                      href={`/perfil/${pro.id}`}
                      className="text-blue-600 underline text-sm"
                    >
                      Ver perfil
                    </Link>
                    <Link
                      href={`/perfil/${pro.id}/calendar`}
                      className="text-blue-600 underline text-sm"
                    >
                      Agendar cita
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Artículos publicados relacionados a este servicio */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Artículos del servicio</h2>
        {service.posts.length === 0 ? (
          <p className="text-gray-600">Aún no hay artículos publicados para este servicio.</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {service.posts.map((p) => (
              <li key={p.id} className="border rounded-lg p-4 hover:shadow">
                <Link href={`/blog/${p.slug}`} className="block">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-44 object-cover rounded-md mb-3"
                    />
                  ) : null}
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    {p.author?.name ?? 'Autor'} · {formatDate(new Date(p.createdAt))} · {p.postType}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Otros servicios relacionados por categoría */}
      {related?.length ? (
        <section className="mb-4">
          <h2 className="text-2xl font-semibold mb-4">Servicios relacionados</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {related.map((s) => (
              <li key={s.id} className="border rounded-lg p-4 flex gap-4 items-center">
                <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <Link href={`/servicios/${s.slug}`} className="font-medium hover:underline">
                    {s.title}
                  </Link>
                  <div className="text-sm text-gray-500 mt-1">{formatPrice(s.price)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
