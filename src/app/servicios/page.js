import { prisma } from '@/lib/prisma'; // ⚠️ Asegúrate que este import sea correcto (a veces es '@/lib/db')
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
      price: true, // ✅ Correcto para el esquema restaurado
      imageUrl: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
      professionals: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
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
    <main className="space-y-6 container mx-auto py-8"> {/* Agregué container para márgenes */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-600">Servicios</h1>
          <p className="text-brand-500 mt-2">
            Elegí el servicio y reservá con un profesional.
          </p>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          // Lógica de "Primer Profesional Disponible"
          const firstLink = service.professionals?.[0];
          const professionalName = firstLink?.professional?.name ?? 'Equipo SMCR';

          // ⚠️ FIX CRÍTICO: Conversión de Decimal a String
          // Si no hacemos esto, Next.js lanzará error al pasar props
          const basePrice = service.price ? service.price.toString() : "0";
          const overridePrice = firstLink?.priceOverride ? firstLink.priceOverride.toString() : null;
          
          // Lógica de visualización de precio
          const displayPrice = overridePrice || basePrice;

          return (
            <ServiceCard
              key={service.id}
              service={{
                ...service,
                // Sobreescribimos los campos complejos con strings seguros
                price: basePrice, 
                priceLabel: displayPrice, // Campo auxiliar útil para la card
                professionalName,
                imageUrl:
                  service.imageUrl ||
                  'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop',
                // Limpiamos 'professionals' para no pasar objetos pesados al cliente si no los usas dentro de la card
                professionals: undefined 
              }}
            />
          );
        })}
      </section>
    </main>
  );
}