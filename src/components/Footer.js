// src/components/Footer.js
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-brand-800/40 bg-brand-800 text-neutral-100">
      <div className="container py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/95 shadow-card ring-1 ring-white/50 overflow-hidden"
              aria-hidden="true"
            >
              <Image
                src="/brand/logo-smcr.svg"
                alt="SMCR Logo"
                fill
                sizes="40px"
                className="object-contain p-1.5"
                priority={false}
              />
            </span>
            <span className="text-base font-semibold">SMCR</span>
          </div>
          <p className="mt-3 text-sm text-neutral-200">
            Salud mental, mentoría y coaching con profesionales validados.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Navegación</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="hover:text-accent-200">Inicio</Link></li>
            <li><Link href="/servicios" className="hover:text-accent-200">Servicios</Link></li>
            <li><Link href="/blog" className="hover:text-accent-200">Blog</Link></li>
            <li><Link href="/nosotros" className="hover:text-accent-200">Nosotros</Link></li>
            <li><Link href="/contacto" className="hover:text-accent-200">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Legales</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/terminos" className="hover:text-accent-200">Términos</Link></li>
            <li><Link href="/privacidad" className="hover:text-accent-200">Privacidad</Link></li>
            <li><Link href="/cookies" className="hover:text-accent-200">Cookies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Contacto</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a href="mailto:hola@smcr.example" className="hover:text-accent-200">hola@smcr.example</a></li>
            <li><a href="tel:+5491100000000" className="hover:text-accent-200">+54 9 11 0000 0000</a></li>
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

      <div className="border-t border-brand-800/40 py-4 text-center text-xs text-neutral-300">
        © {new Date().getFullYear()} SMCR — Todos los derechos reservados.
      </div>
    </footer>
  );
}
