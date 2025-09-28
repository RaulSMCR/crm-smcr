// src/components/Header.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios', href: '/servicios' },
  { label: 'Blog', href: '/blog' },
  { label: 'Nosotros', href: '/nosotros' },
  { label: 'Contacto', href: '/contacto' },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cerrar menú móvil al cambiar de ruta (evita onClick en <Link/>)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-brand-800/40 bg-brand-700/95 backdrop-blur supports-[backdrop-filter]:bg-brand-700/85 text-white">
      <div className="container flex items-center justify-between py-3">
        {/* LOGO grande + lockup */}
        <Link href="/" className="group flex items-center gap-4">
          <span
            className="
              relative inline-flex items-center justify-center
              h-14 w-14 sm:h-16 sm:w-16
              rounded-2xl bg-white shadow-card ring-1 ring-white/40 overflow-hidden
            "
            aria-hidden="true"
          >
            {/* Nota: Next/Image no optimiza SVG, pero sirve perfecto como contenedor responsivo */}
            <Image
              src="/brand/logo-smcr.svg"
              alt="SMCR Logo"
              fill
              sizes="64px"
              className="object-contain p-2"
              priority
            />
          </span>
          <span className="flex flex-col">
            <span className="text-xl sm:text-2xl font-semibold tracking-wide">
              SMCR
            </span>
            <span className="text-xs sm:text-sm text-accent-200/90">
              Salud, Mentoría & Coaching
            </span>
          </span>
        </Link>

        {/* Navegación desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group relative text-sm transition-colors',
                  active ? 'text-accent-200' : 'text-white/90 hover:text-accent-200',
                ].join(' ')}
              >
                <span>{item.label}</span>
                <span
                  className={[
                    'absolute -bottom-2 left-0 h-0.5 bg-accent-500 transition-all',
                    active ? 'w-full' : 'w-0 group-hover:w-full',
                  ].join(' ')}
                />
              </Link>
            );
          })}

          <Link href="/login" className="btn btn-accent ml-2">
            Ingresar
          </Link>
        </nav>

        {/* Botón menú móvil */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-brand-600/60 focus:outline-none focus:ring-2 focus:ring-accent-300"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            {open ? (
              <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeWidth="2" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Menú móvil */}
      {open && (
        <nav className="md:hidden border-t border-brand-800/40 bg-brand-700/95">
          <div className="container py-2">
            <div className="flex flex-col">
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'px-2 py-3 rounded-lg transition-colors',
                      active
                        ? 'bg-brand-600/70 text-accent-100'
                        : 'text-white/90 hover:bg-brand-600/60 hover:text-accent-100',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link href="/login" className="btn btn-accent mt-2">
                Ingresar
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
