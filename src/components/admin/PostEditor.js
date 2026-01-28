'use client';

import { useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

// Utilidad simple para convertir Título a Slug
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Reemplaza espacios con -
    .replace(/[^\w\-]+/g, '') // Elimina caracteres no alfanuméricos
    .replace(/\-\-+/g, '-');  // Reemplaza múltiples - con uno solo
};

export default function PostEditor({ authors, services }) {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    imageUrl: '',
    postType: 'ARTICLE',
    serviceId: '',
    authorId: '',
    status: 'DRAFT'
  });

  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manejador de cambios genérico
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el título, auto-generamos el slug (solo si no se ha editado manualmente)
    if (name === 'title' && !formData.slugDirty) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        slug: slugify(value)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSlugChange = (e) => {
    setFormData(prev => ({ ...prev, slug: slugify(e.target.value), slugDirty: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // AQUÍ CONECTAREMOS CON LA API EN EL SIGUIENTE PASO
      console.log('Enviando datos:', formData);
      alert('Funcionalidad de guardado pendiente de conexión API');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* 1. Metadatos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
              placeholder="Ej: 5 Estrategias para..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
            <div className="flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                /blog/
              </span>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleSlugChange}
                className="flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
           <div>
            <label className="block text-sm font-medium text-gray-700">Imagen de Portada (URL)</label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-700">Servicio Relacionado</label>
               <select
                 name="serviceId"
                 value={formData.serviceId}
                 onChange={handleChange}
                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
               >
                 <option value="">-- Ninguno --</option>
                 {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700">Autor</label>
               <select
                 name="authorId"
                 value={formData.authorId}
                 onChange={handleChange}
                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
               >
                 <option value="">-- Seleccionar --</option>
                 {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
               </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Área de Edición (Split View) */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
          <span className="text-sm font-medium text-gray-700">Contenido (Markdown)</span>
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              isPreview 
                ? 'bg-brand-100 text-brand-700' 
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {isPreview ? '👁️ Ocultar Vista Previa' : '👁️ Ver Vista Previa'}
          </button>
        </div>

        <div className={`grid ${isPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} h-[600px]`}>
          {/* Área de Texto (Siempre visible) */}
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            className="w-full h-full p-4 border-0 focus:ring-0 resize-none font-mono text-sm bg-gray-50"
            placeholder="# Empieza a escribir aquí..."
          />

          {/* Área de Previsualización (Condicional) */}
          {isPreview && (
            <div className="h-full overflow-y-auto p-6 bg-white border-l prose prose-sm max-w-none">
              <MarkdownRenderer content={formData.content || '*La vista previa aparecerá aquí...*'} />
            </div>
          )}
        </div>
      </div>

      {/* 3. Footer de Acciones */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t">
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
        >
          <option value="DRAFT">Borrador</option>
          <option value="PUBLISHED">Publicado</option>
        </select>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-brand-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Post'}
        </button>
      </div>
    </form>
  );
}