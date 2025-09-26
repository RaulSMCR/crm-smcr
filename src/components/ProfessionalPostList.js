// src/components/ProfessionalPostList.js
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProfessionalPostList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchPosts = async () => {
    setLoading(true);
    const response = await fetch('/api/professional/posts');
    if (response.ok) {
      setPosts(await response.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async (postId) => {
    if (confirm('¿Estás seguro de que quieres eliminar este artículo? Esta acción no se puede deshacer.')) {
      setMessage('Eliminando...');
      const response = await fetch(`/api/professional/posts/${postId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMessage('Artículo eliminado con éxito.');
        fetchPosts(); // Recargar la lista
      } else {
        setMessage('Error al eliminar el artículo.');
      }
    }
  };

  if (loading) {
    return <p>Cargando tus artículos...</p>;
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Tus Artículos</h2>
      {message && <p className="text-sm text-center text-gray-600 mb-4">{message}</p>}
      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="border-b pb-2 flex justify-between items-center">
              <div>
                <span className="text-gray-800">{post.title}</span>
                <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                  post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {post.status === 'PENDING' ? 'Pendiente' : 'Publicado'}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                {/* --- BOTÓN DE EDITAR AÑADIDO --- */}
                <Link
                  href={`/dashboard-profesional/editar-articulo/${post.id}`}
                  className="text-blue-500 hover:text-blue-700 text-sm font-semibold"
                >
                  Editar
                </Link>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-semibold"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">Aún no has enviado ningún artículo.</p>
      )}
    </div>
  );
}