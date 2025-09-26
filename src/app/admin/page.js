// src/app/admin/page.js
'use client'; // Esta página es interactiva

import { useState, useEffect } from 'react';

export default function AdminPage() {
  // Un estado para cada lista
  const [pendingProfessionals, setPendingProfessionals] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [message, setMessage] = useState('');

  // Función para obtener TODOS los datos necesarios para el panel
  const fetchData = async () => {
    try {
      const [profResponse, postResponse] = await Promise.all([
        fetch('/api/admin/professionals'),
        fetch('/api/admin/posts')
      ]);

      if (profResponse.ok) {
        setPendingProfessionals(await profResponse.json());
      }
      if (postResponse.ok) {
        setPendingPosts(await postResponse.json());
      }
    } catch (error) {
      console.error("Error al cargar los datos del panel:", error);
      setMessage('No se pudieron cargar los datos del panel.');
    }
  };

  // Se ejecuta una vez cuando la página carga para obtener los datos
  useEffect(() => {
    fetchData();
  }, []);

  // Función para aprobar profesionales
  const handleApproveProfessional = async (professionalId) => {
    setMessage('');
    const response = await fetch(`/api/admin/professionals/${professionalId}/approve`, {
      method: 'PATCH',
    });
    if (response.ok) {
      setMessage('¡Profesional aprobado con éxito!');
      fetchData(); // Recargamos todos los datos
    } else {
      setMessage('Error al aprobar al profesional.');
    }
  };

  // Función para aprobar artículos
  const handleApprovePost = async (postId) => {
    setMessage('');
    const response = await fetch(`/api/admin/posts/${postId}/approve`, {
      method: 'PATCH',
    });
    if (response.ok) {
      setMessage('¡Artículo aprobado y publicado con éxito!');
      fetchData(); // Recargamos todos los datos
    } else {
      setMessage('Error al aprobar el artículo.');
    }
  };

  return (
    <div className="container mx-auto py-12 px-6">
      <h1 className="text-4xl font-bold mb-8">Panel de Administración</h1>
      {message && <p className="text-green-600 bg-green-100 p-2 rounded-md mb-4">{message}</p>}

      {/* Tabla de Profesionales Pendientes */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Profesionales Pendientes de Aprobación</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profesión</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingProfessionals.length > 0 ? (
                pendingProfessionals.map((prof) => (
                  <tr key={prof.id}>
                    <td className="px-6 py-4">{prof.name}</td>
                    <td className="px-6 py-4">{prof.email}</td>
                    <td className="px-6 py-4">{prof.profession}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleApproveProfessional(prof.id)}
                        className="bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-opacity-90"
                      >
                        Aprobar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No hay profesionales pendientes de aprobación.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla de Artículos Pendientes */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Artículos Pendientes de Revisión</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Autor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingPosts.length > 0 ? (
                pendingPosts.map((post) => (
                  <tr key={post.id}>
                    <td className="px-6 py-4">{post.title}</td>
                    <td className="px-6 py-4">{post.author ? post.author.name : 'Autor no disponible'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleApprovePost(post.id)}
                        className="bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-opacity-90"
                      >
                        Aprobar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500">No hay artículos pendientes de revisión.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}