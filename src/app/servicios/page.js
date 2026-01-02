// src/app/servicios/page.js
import { prisma } from '@/lib/prisma';
import ServiceCard from '@/components/ServiceCard';

export const metadata = {
  title: 'Servicios',
  description: 'Listado de servicios disponibles',
};

export default async function ServiciosPage() {
  const services = await prisma.service.findMany({
    orderBy: { title: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      category: {
        select: { id: true, name: true, slug: true },
      },

      // Ahora "professionals" es el pivot ServicesOnProfessionals
      professionals: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }, // opcional: primero el más antiguo (desde cuándo)
        select: {
          id: true, // id del vínculo (pivot)
          createdAt: true,
          status: true,
          priceOverride: true,
          professional: {
            select: {
              id: true,
              name: true,
              profession: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-600">Servicios</h1>
          <p className="text-sm text-brand-300">
            Elegí el servicio y reservá con un profesional.
          </p>
        </div>
      </header>

      <section className="neutral-300 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          // Tomamos el primer vínculo activo (si existe)
          const firstLink = service.professionals?.[0];

          const professionalName = firstLink?.professional?.name ?? 'Equipo SMCR';

          // Si querés mostrar precio real del primer profesional:
          // const displayedPrice = firstLink?.priceOverride ?? service.price;

          return (
            <ServiceCard
              key={service.id}
              service={{
                ...service,
                professionalName,
                // displayedPrice, // <- si tu ServiceCard soporta mostrarlo
                imageUrl:
                  service.imageUrl ||
                  'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop',
              }}
            />
          );
        })}
      </section>
    </main>
  );
}
