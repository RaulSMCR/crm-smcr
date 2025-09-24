// src/components/ProfessionalCtaSection.js
import Link from 'next/link';

export default function ProfessionalCtaSection() {
  return (
    <section className="bg-brand-primary text-white">
      <div className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">
          ¿Eres un profesional?
        </h2>
        <p className="max-w-2xl mx-auto mb-8">
          Únete a nuestra creciente red de especialistas en bienestar y expande tu alcance...
        </p>
        <Link href="/registro/profesional" className="bg-white text-brand-primary font-bold px-8 py-3 rounded-md text-lg hover:bg-gray-100 transition duration-300">
          Únete a nuestra red
        </Link>
      </div>
    </section>
  );
}