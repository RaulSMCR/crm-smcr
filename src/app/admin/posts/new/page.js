// src/app/admin/posts/new/page.js
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
// Si tienes un componente de formulario cliente, impórtalo. 
// Si la lógica está aquí mismo, mantén tu estructura pero con esta consulta corregida:

export default async function NewPostPage() {
  // CORRECCIÓN: Eliminamos "where: { isApproved: true }"
  const professionals = await prisma.professional.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
    },
  });

  async function createPost(formData) {
    'use server';
    
    const title = formData.get('title');
    const slug = formData.get('slug');
    const content = formData.get('content');
    const authorId = formData.get('authorId');

    await prisma.post.create({
      data: {
        title,
        slug,
        content,
        authorId,
        status: 'DRAFT' // Por defecto
      }
    });

    redirect('/admin/posts');
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Crear Nuevo Artículo</h1>
      
      <form action={createPost} className="space-y-6 bg-white p-6 rounded-lg shadow border">
        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input name="title" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
          <input name="slug" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Autor</label>
          <select name="authorId" required className="mt-1 block w-full rounded-md border border-gray-300 p-2">
            <option value="">Seleccione un autor...</option>
            {professionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Contenido</label>
          <textarea name="content" rows={10} required className="mt-1 block w-full rounded-md border border-gray-300 p-2" />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Guardar Borrador
        </button>
      </form>
    </div>
  );
}