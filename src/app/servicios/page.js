// src/app/servicios/page.js
import { prisma } from '@/lib/prisma';
import ServiceCard from '@/components/ServiceCard';

export const metadata = {
  title: 'Servicios',
  description: 'Listado de servicios disponibles',
};

export default async function ServiciosPage() {
  // Solo usamos la relación many-to-many "professionals"
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
      professionals: {
        select: { id: true, name: true },
      },
    },
  });

  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Servicios</h1>
          <p className="text-sm text-neutral-600">
            Elegí el servicio y reservá con un profesional.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const professionalName =
            service.professionals?.[0]?.name ?? 'Equipo SMCR';
          return (
            <ServiceCard
              key={service.id}
              service={{
                ...service,
                professionalName,
                // Fallback visual si faltara imagen en la BD:
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
