// src/components/Header.js
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <div>
          <Link href="/" className="text-2xl font-bold text-gray-800">
            SaludMentalCR
          </Link>
        </div>

        {/* Enlaces de Navegación */}
        <div className="hidden md:flex space-x-6">
          <Link href="/" className="text-gray-600 hover:text-brand-primary">Inicio</Link>
          <Link href="/nosotros" className="text-gray-600 hover:text-brand-primary">Nosotros</Link>
          <Link href="/servicios" className="text-gray-600 hover:text-brand-primary">Servicios</Link>
          <Link href="/blog" className="text-gray-600 hover:text-brand-primary">Blog</Link>
          <Link href="/faq" className="text-gray-600 hover:text-brand-primary">FAQ</Link>
          <Link href="/contacto" className="text-gray-600 hover:text-brand-primary">Contacto</Link>
        </div>

        {/* Botón de Cuenta */}
        <div>
          <Link href="/cuenta" className="bg-brand-primary text-white px-4 py-2 rounded-md hover:bg-opacity-90">
  Cuenta
</Link>
        </div>
      </nav>
    </header>
  );
}