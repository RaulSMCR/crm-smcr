// src/app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import UserAppointmentsPanel from "@/components/UserAppointmentsPanel";

export default function DashboardPage() {
  const [me, setMe] = useState(null); // { ok, role, profile }
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function fetchMe() {
      setErrorMsg("");
      setLoading(true);

      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!alive) return;

        if (!res.ok) {
          router.replace("/login");
          return;
        }

        const data = await res.json();
        // Si por alguna razón viniera algo inesperado
        if (!data?.ok || !data?.profile) {
          router.replace("/login");
          return;
        }

        setMe(data);
      } catch {
        if (!alive) return;
        setErrorMsg("No se pudo verificar tu sesión. Volvé a intentar.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchMe();
    return () => {
      alive = false;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login");
    }
  };

  if (loading) return <div className="text-center py-20">Cargando...</div>;

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorMsg}
        </div>
        <div className="mt-4">
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!me?.profile) return null;

  // Si alguien entra aquí con rol incorrecto, lo mandamos donde corresponde (opcional)
  if (me.role !== "USER" && me.role !== "ADMIN") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Panel de Usuario</h1>
            <p className="text-lg text-gray-600">
              Te damos la bienvenida de nuevo, {me.profile.name}.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700"
          >
            Cerrar Sesión
          </button>
        </div>

        <DashboardNav />
        <UserAppointmentsPanel />
      </div>
    </div>
  );
}
