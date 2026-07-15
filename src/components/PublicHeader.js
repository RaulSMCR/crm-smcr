"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function PublicHeader() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSession(data?.ok ? data : null))
      .catch(() => setSession(null));
  }, []);

  const dashboard = session?.role === "ADMIN"
    ? "/panel/admin"
    : session?.role === "PROFESSIONAL"
      ? "/panel/profesional"
      : "/panel/paciente";

  async function changeView(event) {
    const role = event.target.value;
    const response = await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (response.ok) {
      router.push(role === "ADMIN" ? "/panel/admin" : role === "PROFESSIONAL" ? "/panel/profesional" : "/panel/paciente");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
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
          {session ? (
            <>
              {session.actualRole === "ADMIN" ? (
                <select aria-label="Cambiar vista" value={session.role} onChange={changeView} className="max-w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-700">
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
