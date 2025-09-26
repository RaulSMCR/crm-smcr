// src/app/blog/page.js
import BlogPostCard from "@/components/BlogPostCard";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Función para obtener los artículos de la base de datos
async function getPostsFromDb() {
  const posts = await prisma.post.findMany({
    // Ordenamos los posts por fecha de creación, los más nuevos primero
    orderBy: {
      createdAt: 'desc',
    },
  });
  return posts;
}

export default async function BlogPage() {
  // Obtenemos los artículos reales de la base de datos
  const posts = await getPostsFromDb();

  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">
          Nuestro Blog
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}