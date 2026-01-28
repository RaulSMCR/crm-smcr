// src/components/MarkdownRenderer.js
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import Image from 'next/image';

/**
 * COMPONENTE DE IMAGEN PERSONALIZADO
 * Intercepta la etiqueta estándar <img> de Markdown.
 * * Problema que resuelve:
 * Markdown no sabe de tamaños (width/height), pero Next/Image los exige
 * para evitar CLS (Cumulative Layout Shift).
 * * Solución:
 * Usamos 'fill' junto con un contenedor padre con dimensiones relativas.
 */
const MarkdownImage = ({ src, alt }) => {
  if (!src) return null;

  return (
    // El contenedor define el espacio reservado para la imagen
    <span className="block relative w-full h-[300px] md:h-[450px] my-8 rounded-lg overflow-hidden bg-gray-100 shadow-sm">
      <Image
        src={src}
        alt={alt || 'Imagen del artículo'}
        fill
        className="object-cover hover:scale-105 transition-transform duration-500 ease-in-out"
        // Tamaños responsivos para asegurar que descargamos la versión más ligera posible
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 800px"
      />
    </span>
  );
};

/**
 * COMPONENTE DE ENLACE PERSONALIZADO
 * Intercepta la etiqueta <a>.
 * * Mejora:
 * Abre enlaces externos (http) en nueva pestaña por seguridad y UX.
 * Mantiene enlaces internos en la misma pestaña.
 */
const MarkdownLink = ({ href, children }) => {
  const isExternal = href?.startsWith('http');
  
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-brand-600 font-medium hover:underline hover:text-brand-800 transition-colors"
    >
      {children}
    </a>
  );
};

/**
 * COMPONENTE PRINCIPAL
 */
export default function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      // REMARK PLUGINS: Procesan el Markdown antes de convertirlo a HTML
      // remarkGfm: Habilita tablas, autolinks, listas de tareas y tachado
      remarkPlugins={[remarkGfm]}
      
      // REHYPE PLUGINS: Procesan el HTML resultante
      // rehypeHighlight: Detecta bloques de código y añade clases (hljs-*) para coloreado
      rehypePlugins={[rehypeHighlight]}
      
      // COMPONENTS: Mapeo de elementos HTML a componentes React
      components={{
        img: MarkdownImage,
        a: MarkdownLink,
        
        // Opcional: Personalizar otros elementos si Tailwind Typography no es suficiente
        // table: ({ children }) => <div className="overflow-x-auto my-8"><table>{children}</table></div>
      }}
    >
      {content}
    </ReactMarkdown>
  );
}