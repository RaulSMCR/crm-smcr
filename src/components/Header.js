// PATH: src/components/Header.js
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";

export default async function Header() {
  let session = null;
  let dashboardUrl = "/ingresar";

  // ⚡ Sesión rápida (sin “reventar” el header si algo falla)
  try {
    // Nota: getSession() NO toca DB; solo lee cookie + verifica JWT.
    // Mantengo tu timeout por seguridad, pero 2s es bastante; 800ms suele bastar.
    const sessionPromise = getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Header")), 800)
    );

    session = await Promise.race([sessionPromise, timeoutPromise]);

    if (session) {
      if (session.role === "ADMIN") dashboardUrl = "/panel/admin";
      else if (session.role === "PROFESSIONAL") dashboardUrl = "/panel/profesional";
      else if (session.role === "USER") dashboardUrl = "/panel/paciente";
    }
  } catch (error) {
    console.warn(
      "⚠️ Header: No se pudo verificar sesión (mostrando modo invitado).",
      error?.message
    );
    session = null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        {/* LOGO */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Logo Salud Mental Costa Rica"
            width={52}
            height={52}
            className="h-11 w-auto"
            priority
          />
        </Link>

        {/* NAVEGACIÓN (Desktop) */}
        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
          <Link href="/servicios" className="hover:text-blue-600 transition-colors">
            Servicios
          </Link>
          <Link href="/nosotros" className="hover:text-blue-600 transition-colors">
            Nosotros
          </Link>
          <Link href="/blog" className="hover:text-blue-600 transition-colors">
            Blog
          </Link>
          <Link href="/contacto" className="hover:text-blue-600 transition-colors">
            Contacto
          </Link>
        </nav>

        {/* ZONA DE USUARIO */}
        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden sm:inline-block">
                Hola, {session.name || "Usuario"}
              </span>

              {/* Botón Mi Perfil */}
              <Link
                href={dashboardUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Mi Perfil
              </Link>

              {/* ✅ Logout correcto: Server Action vía form (evita 404 y asegura redirect) */}
              <LogoutButton />
            </div>
          ) : (
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
