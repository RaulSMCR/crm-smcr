import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-brand-900 bg-brand-900 text-neutral-100">
      <div className="container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
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

            <span className="text-base font-bold tracking-wide text-white sm:text-lg">
              Salud Mental
              <br />
              Costa Rica
            </span>
          </div>

          <p className="mt-3 max-w-xs text-sm text-neutral-200">
            Divulgación y atención interdisciplinaria para la salud mental.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Navegación</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="text-neutral-100 hover:text-accent-100">Inicio</Link></li>
            <li><Link href="/servicios" className="text-neutral-100 hover:text-accent-100">Servicios</Link></li>
            <li><Link href="/blog" className="text-neutral-100 hover:text-accent-100">Blog</Link></li>
            <li><Link href="/nosotros" className="text-neutral-100 hover:text-accent-100">Nosotros</Link></li>
            <li><Link href="/contacto" className="text-neutral-100 hover:text-accent-100">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Legales</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/terminos" className="text-neutral-100 hover:text-accent-100">Términos</Link></li>
            <li><Link href="/privacidad" className="text-neutral-100 hover:text-accent-100">Privacidad</Link></li>
            <li><Link href="/cookies" className="text-neutral-100 hover:text-accent-100">Cookies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-accent-200">Contacto</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="mailto:contacto@saludmentalcostarica.com" className="text-neutral-100 hover:text-accent-100">
                contacto@saludmentalcostarica.com
              </a>
            </li>
            <li>
              <a href="tel:+50671291909" className="text-neutral-100 hover:text-accent-100">
                +506 71291909
              </a>
            </li>
          </ul>

          <div className="mt-4 flex gap-3">
            <a aria-label="Instagram" href="#" className="text-white hover:text-accent-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m6.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>
            </a>
            <a aria-label="YouTube" href="#" className="text-white hover:text-accent-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15V9l5 3-5 3m11-3a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-800 py-4 text-center text-xs text-neutral-300">
        © {new Date().getFullYear()} Salud Mental Costa Rica. Todos los derechos reservados.
      </div>
    </footer>
  );
}
