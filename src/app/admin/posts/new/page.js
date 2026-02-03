// src/app/admin/posts/new/page.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function NewPostPage() {
  // 1. CORRECCIÓN: Buscamos en ProfessionalProfile
  // Necesitamos incluir 'user' para poder mostrar el nombre real
  const professionals = await prisma.professionalProfile.findMany({
    include: {
      user: {
        select: { name: true }
      }
    },
    // Ordenamos por el nombre del usuario
    orderBy: {
      user: {
        name: 'asc'
      }
    }
  });

  async function createPost(formData) {
    'use server';
    
    const title = formData.get('title');
    const slug = formData.get('slug');
    const content = formData.get('content');
    const authorId = formData.get('authorId'); // Aquí recibimos el ID del Perfil Profesional

    // Validación básica server-side
    if (!title || !slug || !authorId) {
      // En un caso real, deberíamos manejar errores de validación aquí
      return; 
    }

    await prisma.post.create({
      data: {
        title,
        slug,
        content,
        authorId, // Prisma espera el ID de ProfessionalProfile
        status: 'DRAFT' 
      }
    });

    redirect('/admin/posts'); // Asegúrate de que esta ruta exista o cámbiala a /admin
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Crear Nuevo Artículo</h1>
      
      <form action={createPost} className="space-y-6 bg-white p-6 rounded-lg shadow border border-gray-100">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Título</label>
          <input 
            name="title" 
            type="text" 
            required 
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Ej: La ansiedad en tiempos modernos"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Slug (URL)</label>
          <input 
            name="slug" 
            type="text" 
            required 
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="ej-la-ansiedad-tiempos-modernos"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Autor (Profesional)</label>
          <select 
            name="authorId" 
            required 
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccione un autor...</option>
            {professionals.map(p => (
              // p.id es el ID del perfil (lo que necesitamos)
              // p.user.name es el nombre legible
              <option key={p.id} value={p.id}>
                {p.user.name} ({p.specialty})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contenido</label>
          <textarea 
            name="content" 
            rows={10} 
            required 
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Escribe el contenido del artículo aquí..."
          />
        </div>

        <div className="pt-2">
          <button 
            type="submit" 
            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-black transition shadow-sm"
          >
            Guardar Borrador
          </button>
        </div>
      </form>
    </div>
  );
}