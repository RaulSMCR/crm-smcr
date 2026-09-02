import Link from "next/link";
import LogoTile from "@/components/brand/LogoTile";
import { PHONE_URL, WHATSAPP_DISPLAY, WHATSAPP_URL } from "@/lib/contact-info";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-brand-900 bg-brand-900 text-neutral-100">
      <div className="container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {/* Corte compacto: a 56px "Costa Rica" se cae. El tile va crema
                también sobre este fondo oscuro, por spec de marca. */}
            <LogoTile size={56} className="drop-shadow-lg" />

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
            <li><Link href="/profesionales" className="text-neutral-100 hover:text-accent-100">Profesionales</Link></li>
            <li><Link href="/faq" className="text-neutral-100 hover:text-accent-100">FAQs</Link></li>
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
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-100 hover:text-accent-100"
              >
                WhatsApp: {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li>
              <a href={PHONE_URL} className="text-neutral-100 hover:text-accent-100">
                Llamar: {WHATSAPP_DISPLAY}
              </a>
            </li>
          </ul>

          <div className="mt-2 -ml-3 flex gap-1">
            <a
              aria-label="WhatsApp"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded text-white hover:text-accent-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-100"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.53 0 .2 5.33.2 11.88c0 2.09.55 4.13 1.59 5.93L.1 24l6.33-1.66a11.87 11.87 0 0 0 5.65 1.44h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.18-1.24-6.16-3.45-8.42ZM12.09 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.76.99 1-3.67-.23-.38a9.88 9.88 0 0 1-1.52-5.27C2.17 6.42 6.61 1.98 12.09 1.98c2.65 0 5.14 1.03 7.01 2.91a9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.44 9.89-9.91 9.89Zm5.42-7.42c-.3-.15-1.77-.87-2.04-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48a9 9 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
              </svg>
            </a>
            <a
              aria-label="Instagram"
              href="https://www.instagram.com/saludmentalcostarica/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded text-white hover:text-accent-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-100"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5m5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10m6.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>
            </a>
            <a
              aria-label="YouTube: Salud Mental Costa Rica"
              title="Salud Mental Costa Rica"
              href="https://www.youtube.com/@SMCR506"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-11 items-center justify-center rounded text-white hover:text-accent-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-100"
            >
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
