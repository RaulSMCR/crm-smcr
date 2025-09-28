// src/app/dashboard-profesional/editar-articulo/[id]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PostEditor from '@/components/PostEditor';

async function getPostOrNull(idParam) {
  // Permitimos "new" para crear
  if (!idParam || idParam === 'new' || idParam === 'nuevo') return null;

  const id = Number(idParam);
  if (!Number.isInteger(id)) return null;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrl: true,
      postType: true,
      mediaUrl: true,
      serviceId: true,
      slug: true,
      status: true,
      createdAt: true,
    },
  });

  return post;
}

export default async function EditarArticuloPage({ params }) {
  const idParam = params?.id;
  if (!idParam) notFound();

  const post = await getPostOrNull(idParam);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard-profesional" className="text-sm text-blue-600 underline">
          ← Volver al panel
        </Link>
      </div>

      <PostEditor initial={post} />
    </main>
  );
}
