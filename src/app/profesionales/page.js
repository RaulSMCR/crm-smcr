// src/app/profesionales/page.js
//
// Índice del equipo. Antes vivía en /nosotros, que redirige acá desde S9: los
// breadcrumbs de los perfiles ya apuntaban a /profesionales, una URL que no
// existía — declaraban un 404 en el marcado.
import { prisma } from '@/lib/prisma';
import ProfessionalProfileCard from '@/components/ProfessionalProfileCard';
import { siteUrl } from "@/lib/site-url";
import JsonLd from "@/components/JsonLd";
import { grafo, nodoListado, idPersona } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: 'Nuestro equipo de profesionales',
  description:
    'Conocé al equipo de psicólogos, coaches, nutricionistas y especialistas en bienestar que forman parte de Salud Mental Costa Rica.',
  path: 'profesionales',
});

export const dynamic = 'force-dynamic';

export default async function NosotrosPage() {
  // 1. CORRECCIÓN: Usamos 'professionalProfile' en lugar de 'professional'
  const professionals = await prisma.professionalProfile.findMany({
    where: {
      isApproved: true,
      user: { is: { isActive: true } },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      specialty: true,
      bio: true,
      profileReview: true,
      slug: true,
      licenseNumber: true,
      // 2. CORRECCIÓN: Obtenemos nombre y foto desde la relación con User
      user: {
        select: {
          name: true,
          image: true 
        }
      },
      serviceAssignments: {
        take: 3,
        where: {
          status: 'APPROVED',
        },
        select: {
          service: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* El índice del equipo apunta al `@id` de cada perfil, donde la persona
          está descrita con su colegiatura verificada. */}
      {professionals.length ? (
        <JsonLd
          data={grafo(
            nodoListado({
              id: `${siteUrl("profesionales")}#equipo`,
              nombre: "Equipo de Salud Mental Costa Rica",
              items: professionals
                .filter((p) => p.slug)
                .map((p) => ({
                  url: siteUrl(`profesionales/${p.slug}`),
                  nombre: p.user?.name || "Profesional",
                  id: idPersona(p.slug),
                })),
            }),
          )}
        />
      ) : null}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-light text-gray-900 mb-4">Nuestro Equipo</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Profesionales dedicados al bienestar emocional y mental, altamente calificados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {professionals.map((pro) => (
          <ProfessionalProfileCard key={pro.id} professional={pro} />
        ))}
      </div>
    </main>
  );
}
