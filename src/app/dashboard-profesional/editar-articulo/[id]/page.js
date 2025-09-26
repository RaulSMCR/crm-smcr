// src/app/dashboard-profesional/editar-articulo/[id]/page.js
import PostEditor from "@/components/PostEditor";
import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';

const prisma = new PrismaClient();

// Función para obtener los datos de un único post
async function getPostData(postId) {
  const post = await prisma.post.findUnique({
    where: { id: parseInt(postId) },
  });
  return post;
}

export default async function EditPostPage({ params }) {
  const post = await getPostData(params.id);

  // Si el post no existe, mostramos un 404
  if (!post) {
    notFound();
  }

  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800">
            Editar Artículo
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Realiza los cambios necesarios y vuelve a enviarlo para revisión.
          </p>
        </div>
        {/* Le pasamos los datos del post al editor para que se rellene */}
        <PostEditor existingPost={post} />
      </div>
    </div>
  );
}