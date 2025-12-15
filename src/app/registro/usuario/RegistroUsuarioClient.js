// src/app/registro/usuario/RegistroUsuarioClient.js
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function RegistroUsuarioClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Si no viene redirect, manda a un lugar genérico
  const redirectTo = searchParams.get("redirect") || "/panel";

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: acá va tu lógica real de registro/login
      router.push(redirectTo);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto py-16 px-6">
      <h1 className="text-2xl font-bold text-brand-700 mb-6">
        Registro de usuario
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Nombre completo
          </label>
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Correo electrónico
          </label>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-200"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-neutral-100 hover:bg-brand-600 transition"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
