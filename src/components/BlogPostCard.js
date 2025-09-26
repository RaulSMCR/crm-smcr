// src/components/BlogPostCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function BlogPostCard({ post }) {
  return (
    // El enlace ahora se construye con el slug del post
    <Link href={`/blog/${post.slug}`} className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div className="relative w-full h-48">
        <Image
          src={post.imageUrl}
          alt={`Imagen para ${post.title}`}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{post.title}</h3>
        {/* Usamos 'content' en lugar de 'excerpt' para que coincida con nuestro modelo de base de datos */}
        <p className="text-gray-600 line-clamp-3">{post.content}</p>
      </div>
    </Link>
  );
}