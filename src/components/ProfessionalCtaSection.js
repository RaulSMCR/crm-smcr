// src/components/ProfessionalCtaSection.js
import Link from 'next/link';

export default function ProfessionalCtaSection() {
  return (
    <section className="bg-brand-primary text-neutral-250">
      <div className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-brand-600 text-3xl font-bold mb-4">
          ¿Eres un profesional interesado aportar a la salud mental de sus clientes?
        </h2>
        <p className="text-brand-600 max-w-2xl mx-auto mb-8">
          Únete a nuestro equipo interdisciplinario de especialistas en bienestar, mejora tu efectividad y expande tu alcance.
        </p>
        <Link href="/registro/profesional" className="bg-brand-600 text-neutral-200 font-bold px-8 py-3 rounded-md text-lg hover:bg-neutral-100 transition duration-300">
          Únete a nuestro equipo.
        </Link>
      </div>
    </section>
  );
}