// src/components/PostEditor.js
'use client';
import { useState } from 'react';

export default function PostEditor() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    postType: 'text',
    mediaUrl: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- ESTA ES LA FUNCIÓN ACTUALIZADA ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Enviando...');

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('¡Artículo enviado para revisión con éxito!');
        // Limpiar el formulario después de un envío exitoso
        setFormData({ title: '', content: '', imageUrl: '', postType: 'text', mediaUrl: '' });
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Ocurrió un error al enviar el artículo.');
      }
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Crear Nuevo Artículo</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 font-medium mb-2">Título del Artículo</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md" />
        </div>

        <div className="mb-4">
          <label htmlFor="postType" className="block text-gray-700 font-medium mb-2">Tipo de Contenido</label>
          <select name="postType" value={formData.postType} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
            <option value="text">Artículo de Texto</option>
            <option value="video">Video</option>
            <option value="audio">Audio (Podcast)</option>
          </select>
        </div>

        {formData.postType === 'text' && (
          <div className="mb-4">
            <label htmlFor="imageUrl" className="block text-gray-700 font-medium mb-2">URL de la Imagen de Cabecera (Opcional)</label>
            <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://..." className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
        )}

        {(formData.postType === 'video' || formData.postType === 'audio') && (
          <div className="mb-4">
            <label htmlFor="mediaUrl" className="block text-gray-700 font-medium mb-2">URL del Video/Audio (para incrustar)</label>
            <input type="url" name="mediaUrl" value={formData.mediaUrl} onChange={handleChange} placeholder="https://www.youtube.com/embed/..." className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="content" className="block text-gray-700 font-medium mb-2">Contenido del Artículo</label>
          <textarea name="content" value={formData.content} onChange={handleChange} required rows="10" className="w-full p-2 border border-gray-300 rounded-md"></textarea>
        </div>

        <button type="submit" className="w-full bg-brand-primary text-white p-3 rounded-lg font-semibold hover:bg-opacity-90">
          Enviar para Revisión
        </button>
        {message && <p className="mt-4 text-center text-sm text-green-600">{message}</p>}
      </form>
    </div>
  );
}