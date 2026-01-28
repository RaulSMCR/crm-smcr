import { prisma } from '@/lib/prisma';
import PostEditor from '@/components/admin/PostEditor';

export const metadata = {
  title: 'Nuevo Post | Admin CRM',
};

export default async function NewPostPage() {
  // Obtenemos datos para los dropdowns
  const [authors, services] = await Promise.all([
    // Buscamos profesionales aprobados para ser autores
    prisma.professional.findMany({
      where: { isApproved: true },
      select: { id: true, name: true }
    }),
    // Buscamos servicios activos
    prisma.service.findMany({
      select: { id: true, title: true }
    })
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Crear Nueva Publicación</h1>
        <p className="text-sm text-gray-500">
          Redacta artículos optimizados para SEO usando Markdown.
        </p>
      </div>
      
      <div className="bg-white rounded-xl shadow-card p-6 border border-gray-100">
        <PostEditor authors={authors} services={services} />
      </div>
    </div>
  );
}