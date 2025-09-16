// src/app/perfil/[id]/page.js
import Link from 'next/link';
import { professionals, posts } from '@/data/mockData'; // Import both professionals and posts

export default function ProfilePage({ params }) {
  // Find the professional using the ID from the URL
  const professional = professionals.find(p => p.id.toString() === params.id);

  // If no professional is found, show an error message
  if (!professional) {
    return (
      <div className="container mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl font-bold">Profesional no encontrado</h1>
        <Link href="/" className="text-brand-primary mt-4 inline-block">
          Volver al inicio
        </Link>
      </div>
    );
  }

  // Find all posts written by this professional
  const professionalPosts = posts.filter(p => p.authorId === professional.id);

  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Professional's Details */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800">{professional.name}</h1>
          <p className="text-xl text-brand-primary mt-2">{professional.role}</p>
        </div>

        {/* List of their Articles */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Artículos de este profesional:</h2>
          <div className="space-y-4">
            {professionalPosts.length > 0 ? (
              professionalPosts.map(post => (
                <Link key={post.slug} href={post.href} className="block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                </Link>
              ))
            ) : (
              <p className="text-gray-600">Este profesional aún no ha publicado artículos.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}