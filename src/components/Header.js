// src/components/Header.js
import Link from 'next/link';
import { getSession } from '@/lib/auth';

export default async function Header() {
  let session = null;
  let dashboardUrl = '/ingresar';

  // 🛡️ INTENTO DE SESIÓN SEGURO (Anti-Bloqueo)
  try {
    // Intentamos obtener la sesión, pero si la DB falla, no explotamos.
    // Usamos un timeout corto (2s) para no ralentizar la web si la DB está dormida.
    const sessionPromise = getSession();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout Header")), 2000)
    );
    
    session = await Promise.race([sessionPromise, timeoutPromise]);

    // Si hay sesión, definimos a dónde va el botón "Mi Perfil"
    if (session) {
      if (session.role === 'ADMIN') dashboardUrl = '/panel/admin';
      else if (session.role === 'PROFESSIONAL') dashboardUrl = '/panel/profesional';
      else if (session.role === 'USER') dashboardUrl = '/panel/paciente';
    }
  } catch (error) {
    console.warn("⚠️ Header: No se pudo verificar sesión (mostrando modo invitado).", error.message);
    session = null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center space-x-2 font-bold text-xl text-blue-900">
            <span>SMCR</span>
        </Link>

        {/* NAVEGACIÓN (Desktop) */}
        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
          <Link href="/servicios" className="hover:text-blue-600 transition-colors">Servicios</Link>
          <Link href="/nosotros" className="hover:text-blue-600 transition-colors">Nosotros</Link>
          <Link href="/blog" className="hover:text-blue-600 transition-colors">Blog</Link>
          <Link href="/contacto" className="hover:text-blue-600 transition-colors">Contacto</Link>
        </nav>

        {/* ZONA DE USUARIO (Dinámica) */}
        <div className="flex items-center gap-4">
          
          {session ? (
            // --- ESTADO: LOGUEADO ---
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden sm:inline-block">
                Hola, {session.name || 'Usuario'}
              </span>
              
              {/* Botón Mi Perfil */}
              <Link 
                href={dashboardUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Mi Perfil
              </Link>

              {/* Botón Salir (Formulario Server Action simple) */}
              <form action="/api/auth/logout" method="POST">
                <button 
                  type="submit"
                  className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Salir
                </button>
              </form>
            </div>
          ) : (
            // --- ESTADO: INVITADO ---
            <div className="flex items-center gap-2">
              <Link 
                href="/ingresar"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Ingresar
              </Link>
              <Link 
                href="/registro"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Registrarse
              </Link>
            </div>
          )}

        </div>
      </div>
    </header>
  );
}