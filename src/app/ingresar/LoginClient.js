// src/app/ingresar/LoginClient.js
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/actions/auth-actions"; // Importamos la Server Action nueva

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition(); // Usamos useTransition para estados de carga nativos
  const [error, setError] = useState(null);

  // Detectar mensaje de registro exitoso
  const isRegistered = searchParams.get("registered") === "true";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Extraemos los datos del formulario directamente
    const formData = new FormData(e.target);

    startTransition(async () => {
      // Llamamos a la Server Action (Backend)
      const res = await login(formData);

      if (res?.error) {
        setError(res.error);
      } else {
        // Redirección inteligente según ROL
        // Buscamos si había una url previa ('next'), si no, vamos al panel correspondiente
        const nextParam = searchParams.get("next");
        
        if (nextParam && nextParam.startsWith("/")) {
          router.push(nextParam);
        } else if (res.role === "PROFESSIONAL") {
          router.push("/panel/profesional");
        } else {
          router.push("/panel/paciente");
        }
        
        router.refresh(); // Actualizamos la sesión en el navegador
      }
    });
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido de nuevo</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresa a tu panel de gestión</p>
        </div>

        {/* Mensaje de éxito tras registro */}
        {isRegistered && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm text-center font-medium border border-green-200 shadow-sm">
            ✨ ¡Cuenta creada con éxito! <br/> Por favor inicia sesión con tus credenciales.
          </div>
        )}

        {/* Mensaje de Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-200 font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="nombre@ejemplo.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" class="block text-sm font-semibold text-gray-700">
                  Contraseña
                </label>
                <a href="/recuperar" className="text-xs text-blue-600 hover:underline">
                  ¿Olvidaste tu contraseña?
                </a>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-black transition transform active:scale-[0.99] disabled:opacity-70 shadow-md"
          >
            {isPending ? "Iniciando sesión..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center text-sm text-gray-600">
          <p className="mb-2">¿Aún no tienes cuenta?</p>
          <div className="flex justify-center gap-4 font-medium">
             <a className="text-blue-600 hover:text-blue-800 hover:underline" href="/registro/usuario">
               Soy Paciente
             </a>
             <span className="text-gray-300">|</span>
             <a className="text-blue-600 hover:text-blue-800 hover:underline" href="/registro/profesional">
               Soy Profesional
             </a>
          </div>
        </div>
      </div>
    </main>
  );
}