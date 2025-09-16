// src/components/HeroSection.js
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative bg-gray-800 text-white">
      {/* Ya no necesitamos la capa oscura ni la imagen */}

      {/* Contenido */}
      <div className="container mx-auto px-6 py-40 text-center">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
          Profesionales al servicio de tu bienestar
        </h1>
        <p className="text-lg md:text-xl mb-8">
          Al alcance de tus manos, donde y cuando sea.
        </p>
        <Link href="/servicios" className="bg-brand-primary text-white font-bold px-8 py-3 rounded-md text-lg hover:bg-opacity-90 transition duration-300">
          Ver Servicios
        </Link>
      </div>
    </section>
  );
}