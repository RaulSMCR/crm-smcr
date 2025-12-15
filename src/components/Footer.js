// src/components/Footer.js
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-brand-800/40 bg-brand-800 text-neutral-100">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* LOGO + Marca */}
        <div>
          <div className="flex items-center gap-3">
            {/* Logo sin borde */}
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <Image
                src="/logo.svg"
                alt="Logo Salud Mental Costa Rica"
                fill
                sizes="56px"
                className="object-contain drop-shadow-lg"
                priority={false}
              />
            </div>

            <span className="text-base sm:text-lg font-bold tracking-wide text-brand-100">
              Salud Mental<br />Costa Rica
            </span>
          </div>

          <p className="mt-3 text-sm text-neutral-300 max-w-xs">
            Divulgación y atención interdisciplinaria para la salud mental.
          </p>
        </div>

        {/* Navegación */}
        <div>
          <h4 className="text-sm font-semibold text-accent-200">Navegación</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="text-neutral-200 hover:text-accent-200">Inicio</Link></li>
            <li><Link href="/servicios" className="text-neutral-200 hover:text-accent-200">Servicios</Link></li>
            <li><Link href="/blog" className="text-neutral-200 hover:text-accent-200">Blog</Link></li>
            <li><Link href="/nosotros" className="text-neutral-200 hover:text-accent-200">Nosotros</Link></li>
            <li><Link href="/contacto" className="text-neutral-200 hover:text-accent-200">Contacto</Link></li>
          </ul>
        </div>

        {/* Legales */}
        <div>
          <h4 className="text-sm font-semibold text-accent-200">Legales</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/terminos" className="text-neutral-200 hover:text-accent-200">Términos</Link></li>
            <li><Link href="/privacidad" className="text-neutral-200 hover:text-accent-200">Privacidad</Link></li>
            <li><Link href="/cookies" className="text-neutral-200 hover:text-accent-200">Cookies</Link></li>
          </ul>
        </div>

        {/* Contacto + RRSS */}
        <div>
          <h4 className="text-sm font-semibold text-accent-200">Contacto</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="mailto:hola@smcr.example" className="text-neutral-200 hover:text-accent-200">contacto@saludmentalcostarica.com</a></li>
            <li><a href="tel:+5491100000000" className="text-neutral-200 hover:text-accent-200">+506 71291909</a></li>
          </ul>

          <div className="mt-4 flex gap-3">
            <a aria-label="Instagram" href="#" className="text-white/80 hover:text-accent-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m6.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>
            </a>
            <a aria-label="YouTube" href="#" className="text-white/80 hover:text-accent-200">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15V9l5 3-5 3m11-3a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-800/40 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} Salud Mental Costa Rica — Todos los derechos reservados.
      </div>
    </footer>
  );
}
