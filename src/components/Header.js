"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
// 👇 IMPORTANTE: Conectamos con tus Server Actions
import { getSession, logout } from "@/actions/auth-actions";

const NAV = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Blog", href: "/blog" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Contacto", href: "/contacto" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Auth state
  const [me, setMe] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Cerrar menú al cambiar ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // 1. Cargar sesión al iniciar (Usando Server Action)
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setAuthLoading(true);
      try {
        // 👇 Reemplazamos fetch por la Server Action
        const session = await getSession();
        
        if (!alive) return;

        if (session && session.userId) {
          setMe(session); // Guardamos la sesión (incluye role, email, user.name)
        } else {
          setMe(null);
        }
      } catch (error) {
        console.error("Error cargando sesión:", error);
        if (alive) setMe(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }

    loadMe();
    return () => { alive = false; };
  }, [pathname]); // Se recarga al navegar para mantener sincronía

  // 2. Determinar URL del Dashboard según ROL
  const dashboardUrl = useMemo(() => {
    if (!me) return "/ingresar"; // 👇 Corregido a /ingresar
    if (me.role === "ADMIN") return "/admin";
    if (me.role === "PROFESSIONAL") return "/panel/profesional"; // 👇 Ajustado a ruta real
    return "/panel/paciente"; // 👇 Ajustado a ruta real
  }, [me]);

  // 3. Función de Logout (Usando Server Action)
  const handleLogout = async () => {
    try {
      await logout(); // 👇 Server Action que borra la cookie
      setMe(null);
      router.refresh(); 
      // No hace falta router.push porque la acción logout ya hace redirect, 
      // pero por seguridad en cliente:
      // router.push("/ingresar"); 
    } catch (error) {
      console.error("Error al salir", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-brand-800/40 bg-brand-700/95 backdrop-blur text-white shadow-md">
      <div className="container flex items-center justify-between py-3">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="relative h-12 w-12 sm:h-16 sm:w-16 transition-transform group-hover:scale-105">
            <Image
              src="/logo.svg"
              alt="Logo SMCR"
              fill
              className="object-contain drop-shadow-md"
              priority
            />
          </div>
          <span className="flex flex-col leading-tight">
            <span className="text-lg sm:text-xl font-bold tracking-wide text-neutral-100">
              Salud Mental<br />Costa Rica
            </span>
          </span>
        </Link>

        {/* NAVEGACIÓN DESKTOP */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-accent-300" : "text-white/80 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* ÁREA DE USUARIO */}
          <div className="ml-4 flex items-center gap-3 border-l border-white/20 pl-6">
            {authLoading ? (
              // Skeleton loading
              <div className="h-8 w-20 bg-white/10 rounded animate-pulse" />
            ) : me ? (
              <>
                <Link 
                  href={dashboardUrl}
                  className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-md text-sm font-semibold transition shadow-sm"
                >
                  Mi Panel
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-sm text-white/70 hover:text-red-300 transition font-medium"
                >
                  Salir
                </button>
              </>
            ) : (
              // 👇 Corregido href a /ingresar
              <Link 
                href="/ingresar" 
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-md text-sm font-semibold transition border border-white/30"
              >
                Ingresar
              </Link>
            )}
          </div>
        </nav>

        {/* BOTÓN MÓVIL */}
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            {open ? (
              <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeWidth="2" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* MENÚ MÓVIL */}
      {open && (
        <nav className="md:hidden border-t border-brand-800/50 bg-brand-800 p-4 animate-in slide-in-from-top-2">
          <div className="flex flex-col gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-3 rounded-lg hover:bg-white/10 text-white"
              >
                {item.label}
              </Link>
            ))}
            
            <hr className="border-white/10 my-2" />

            {me ? (
              <>
                <Link 
                  href={dashboardUrl}
                  className="block text-center bg-accent-500 text-white py-3 rounded-lg font-bold"
                >
                  Ir a Mi Panel
                </Link>
                <button 
                  onClick={handleLogout}
                  className="block w-full text-center py-3 text-red-300 hover:text-red-200"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              // 👇 Corregido href a /ingresar
              <Link href="/ingresar" className="block text-center bg-white/20 text-white py-3 rounded-lg font-bold">
                Ingresar
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}