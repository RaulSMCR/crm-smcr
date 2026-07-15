"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function PublicHeader() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSession(data?.user || data?.session || null))
      .catch(() => setSession(null));
  }, []);
  const dashboard = session?.role === "ADMIN" ? "/panel/admin" : session?.role === "PROFESSIONAL" ? "/panel/profesional" : "/panel/paciente";
  return <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur"><div className="container flex h-20 items-center justify-between"><Link href="/"><Image src="/logo.svg" alt="Logo Salud Mental Costa Rica" width={80} height={80} className="h-14 w-auto md:h-16" priority /></Link><nav className="hidden gap-6 text-sm font-medium text-gray-600 md:flex"><Link href="/servicios">Servicios</Link><Link href="/nosotros">Nosotros</Link><Link href="/blog">Blog</Link><Link href="/faq">FAQs</Link></nav><div className="flex items-center gap-3">{session ? <><Link href={dashboard} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Mi perfil</Link><LogoutButton /></> : <Link href="/ingresar" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Ingresar</Link>}</div></div></header>;
}
