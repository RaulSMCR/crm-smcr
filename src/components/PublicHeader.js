"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { getPatientHeaderLinks } from "@/lib/public-header-navigation";

const PATIENT_LINK_STYLES = {
  profile: "border border-brand-300 bg-brand-50 text-brand-950 hover:bg-brand-100 focus-visible:ring-brand-300",
  services: "border border-brand-700 bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-300",
  blog: "border border-accent-800 bg-accent-800 text-white hover:bg-accent-900 focus-visible:ring-accent-300",
};

export default function PublicHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Revalida en cada cambio de ruta (dependencia `pathname`): sin esto, el header
  // se queda con el estado del montaje inicial y muestra "Ingresar" incluso
  // después de loguearse. Usa /api/auth/session (verifica el JWT SIN tocar la DB)
  // en vez de /api/auth/me (que corre getSession() y tarda segundos).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (!cancelled) setSession(data?.ok ? data : null);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  const dashboard = session?.role === "ADMIN"
    ? "/panel/admin"
    : session?.role === "PROFESSIONAL"
      ? "/panel/profesional"
      : "/mi";
  const isPatient = session?.role === "USER";
  const patientLinks = isPatient ? getPatientHeaderLinks(pathname) : [];

  async function changeView(role) {
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (response.ok) {
      setSession((current) => current ? { ...current, role, isPreview: role !== "ADMIN" } : current);
      router.push(role === "ADMIN" ? "/panel/admin" : role === "PROFESSIONAL" ? "/panel/profesional" : "/panel/paciente");
      router.refresh();
    }
  }

  const previewLabel = session?.role === "PROFESSIONAL" ? "profesional" : "usuario";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      {session?.isPreview ? (
        <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
          <span>Estás viendo como {previewLabel}. Las acciones de pago, facturación y documentos están bloqueadas.</span>
          <button type="button" onClick={() => changeView("ADMIN")} className="rounded-md bg-amber-950 px-2 py-1 text-xs font-semibold text-amber-50">
            Salir del modo
          </button>
        </div>
      ) : null}
      <div className="container flex min-h-20 flex-wrap items-center justify-between gap-3 py-2">
        <Link href="/">
          <Image src="/logo.svg" alt="Logo Salud Mental Costa Rica" width={80} height={80} className="h-14 w-auto md:h-16" priority />
        </Link>
        {!isPatient ? (
          <nav className="hidden gap-6 text-sm font-medium text-neutral-600 md:flex">
            <Link href="/servicios" className="transition-colors hover:text-brand-700">Servicios</Link>
            <Link href="/nosotros" className="transition-colors hover:text-brand-700">Nosotros</Link>
            <Link href="/blog" className="transition-colors hover:text-brand-700">Blog</Link>
            <Link href="/faq" className="transition-colors hover:text-brand-700">FAQs</Link>
          </nav>
        ) : null}
        <div className={`flex flex-wrap items-center justify-end gap-2 ${isPatient ? "w-full sm:w-auto" : ""}`}>
          {!sessionChecked ? null : session ? (
            <>
              {session.actualRole === "ADMIN" ? (
                <select aria-label="Cambiar vista" value={session.role} onChange={(event) => changeView(event.target.value)} className="max-w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700">
                  <option value="ADMIN">Admin</option>
                  <option value="PROFESSIONAL">Profesional</option>
                  <option value="USER">Usuario</option>
                </select>
              ) : null}
              {isPatient ? (
                <nav aria-label="Navegación del paciente" className="flex flex-wrap items-center justify-end gap-2">
                  {patientLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 sm:text-sm ${PATIENT_LINK_STYLES[link.tone]}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              ) : (
                <Link href={dashboard} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800">Mi perfil</Link>
              )}
              <LogoutButton variant="header" />
            </>
          ) : (
            <Link href="/ingresar" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
