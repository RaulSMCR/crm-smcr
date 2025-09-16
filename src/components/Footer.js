// src/components/Footer.js
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Columna 1: Logo y descripción */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">SaludMentalCR</h3>
            <p className="text-sm">Profesionales al servicio de tu bienestar.</p>
          </div>

          {/* Columna 2: Categorías */}
          <div>
            <h4 className="font-semibold text-white mb-4">Categorías</h4>
            <ul>
              <li className="mb-2"><Link href="/servicios/psicologia" className="hover:text-brand-primary">Psicología</Link></li>
              <li className="mb-2"><Link href="/servicios/nutricion" className="hover:text-brand-primary">Nutrición</Link></li>
              <li className="mb-2"><Link href="/servicios/terapia" className="hover:text-brand-primary">Terapia Ocupacional</Link></li>
              <li className="mb-2"><Link href="/servicios/coaching" className="hover:text-brand-primary">Coaching de Vida</Link></li>
            </ul>
          </div>

          {/* Columna 3: Comunidad */}
          <div>
            <h4 className="font-semibold text-white mb-4">Comunidad</h4>
            <ul>
              <li className="mb-2"><Link href="/blog" className="hover:text-brand-primary">Blog</Link></li>
              <li className="mb-2"><Link href="/faq" className="hover:text-brand-primary">Preguntas Frecuentes</Link></li>
              <li className="mb-2"><Link href="/nosotros" className="hover:text-brand-primary">Sobre Nosotros</Link></li>
            </ul>
          </div>

          {/* Columna 4: Contacto */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contacto</h4>
            <p>info@saludmentalcr.com</p>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm">
          <p>&copy; 2025 SaludMentalCR. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}