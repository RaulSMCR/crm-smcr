// src/components/Header.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Blog", href: "/blog" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Contacto", href: "/contacto" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // auth state (null = no autenticado)
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Cargar sesión para cambiar "Ingresar" -> "Perfil"
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setAuthLoading(true);
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!alive) return;

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.ok && data?.role) setMe(data);
          else setMe(null);
        } else {
          setMe(null);
        }
      } catch {
        if (!alive) return;
        setMe(null);
      } finally {
        if (!alive) return;
        setAuthLoading(false);
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

  const profileHref = useMemo(() => {
    if (!me?.role) return "/login";
    if (me.role === "ADMIN") return "/admin";
    if (me.role === "PROFESSIONAL") return "/dashboard-profesional";
    return "/dashboard"; // USER
  }, [me]);

  const authLabel = me?.role ? "Perfil" : "Ingresar";

  return (
    <header className="sticky top-0 z-50 border-b border-brand-800/40 bg-brand-700/95 backdrop-blur supports-[backdrop-filter]:bg-brand-700/85 text-white">
      <div className="container flex items-center justify-between py-3">
        {/* LOGO sin borde + lockup */}
        <Link href="/" className="group flex items-center gap-4">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20">
            <Image
              src="/logo.svg"
              alt="Logo Salud Mental Costa Rica"
              fill
              sizes="80px"
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>

          <span className="flex flex-col leading-tight">
            <span className="text-xl sm:text-2xl font-bold tracking-wide text-neutral-200">
              Salud Mental
              <br />
              Costa Rica
            </span>
            <span className="mt-1 text-xs sm:text-sm text-accent-200/90">
              Divulgación y atención interdisciplinaria para la salud mental
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
                  "group relative text-sm transition-colors",
                  active ? "text-accent-200" : "text-white/90 hover:text-accent-200",
                ].join(" ")}
              >
                <span>{item.label}</span>
                <span
                  className={[
                    "absolute -bottom-2 left-0 h-0.5 bg-accent-500 transition-all",
                    active ? "w-full" : "w-0 group-hover:w-full",
                  ].join(" ")}
                />
              </Link>
            );
          })}

          {/* Botón auth: Ingresar/Perfil */}
          {/* Mientras carga auth, mostramos Ingresar para evitar flicker raro */}
          <Link href={authLoading ? "/login" : profileHref} className="btn btn-accent ml-2">
            {authLoading ? "Ingresar" : authLabel}
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
                      "px-2 py-3 rounded-lg transition-colors",
                      active
                        ? "bg-brand-600/70 text-accent-100"
                        : "text-white/90 hover:bg-brand-600/60 hover:text-accent-100",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Botón auth móvil */}
              <Link href={authLoading ? "/login" : profileHref} className="btn btn-accent mt-2">
                {authLoading ? "Ingresar" : authLabel}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
