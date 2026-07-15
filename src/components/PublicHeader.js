"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function PublicHeader() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSession(attempt = 0) {
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (!cancelled) setSession(data?.ok ? data : null);
      } catch {
        if (attempt < 1) {
          window.setTimeout(() => loadSession(attempt + 1), 500);
          return;
        }
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled && attempt > 0) setSessionChecked(true);
      }
      if (!cancelled && attempt === 0) setSessionChecked(true);
    }
    loadSession();
    return () => { cancelled = true; };
  }, []);

  const dashboard = session?.role === "ADMIN"
    ? "/panel/admin"
    : session?.role === "PROFESSIONAL"
      ? "/panel/profesional"
      : "/panel/paciente";

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
      <div className="container flex min-h-20 items-center justify-between gap-4 py-2">
        <Link href="/">
          <Image src="/logo.svg" alt="Logo Salud Mental Costa Rica" width={80} height={80} className="h-14 w-auto md:h-16" priority />
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-gray-600 md:flex">
          <Link href="/servicios">Servicios</Link>
          <Link href="/nosotros">Nosotros</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/faq">FAQs</Link>
        </nav>
        <div className="flex items-center gap-2">
          {!sessionChecked ? null : session ? (
            <>
              {session.actualRole === "ADMIN" ? (
                <select aria-label="Cambiar vista" value={session.role} onChange={(event) => changeView(event.target.value)} className="max-w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700">
                  <option value="ADMIN">Admin</option>
                  <option value="PROFESSIONAL">Profesional</option>
                  <option value="USER">Usuario</option>
                </select>
              ) : null}
              <Link href={dashboard} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Mi perfil</Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/ingresar" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
