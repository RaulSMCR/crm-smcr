// src/app/ingresar/LoginClient.js
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/actions/auth-actions";
import Link from "next/link";

function safeNextPath(nextValue) {
  const next = String(nextValue || "");
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get("registered");
  const isProfessionalRegistered = registered === "professional";
  const isGenericRegistered = registered === "true" || registered === "user";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const res = await login(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    if (res?.success) {
      const next = safeNextPath(searchParams.get("next"));
      if (next) {
        router.push(next);
        return;
      }

      if (res.role === "ADMIN") router.push("/panel/admin");
      else if (res.role === "PROFESSIONAL") router.push("/panel/profesional");
      else router.push("/panel/paciente");
      return;
    }

    setError("No se logró iniciar sesión. Por favor, intente nuevamente.");
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6"
      >
        <div className="text-center pb-4 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Ingreso seguro</h2>
          <p className="text-sm text-gray-500 mt-1">Acceso seguro a la cuenta de Salud Mental Costa Rica.</p>
        </div>

        {isProfessionalRegistered && (
          <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm border border-green-200 font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold">Postulación profesional enviada con éxito</span>
            </div>

            <p className="mt-2 text-green-900">El proceso de habilitación avanza en 2 pasos:</p>

            <ol className="mt-2 list-decimal list-inside space-y-1">
              <li>
                <span className="font-semibold">Verificación por correo:</span> revise su correo (incluida la carpeta de spam).
              </li>
              <li>
                <span className="font-semibold">Entrevista y aprobación:</span> el coordinador del sitio se comunicará por teléfono o WhatsApp para agendar entrevista.
              </li>
            </ol>

            <p className="mt-2 text-xs text-green-800">
              Mientras se completa la revisión, la postulación puede mostrarse como <span className="font-semibold">"en revisión"</span>.
            </p>
          </div>
        )}

        {!isProfessionalRegistered && isGenericRegistered && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200 font-medium flex items-center gap-2">
            Cuenta creada con éxito. Revise su correo para verificarla y habilitar el acceso.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 font-medium flex items-center gap-2">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Correo electrónico</label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="correo@dominio.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña</label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <div className="mt-2 text-right text-sm">
              <Link href="/recuperar" className="underline text-gray-600 hover:text-gray-900">
                ¿Olvidó su contraseña?
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-3.5 rounded-lg font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex justify-center items-center"
          >
            {loading ? "Validando acceso..." : "Ingresar"}
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 mt-6 pt-4 border-t border-gray-100">
          Si aún no dispone de una cuenta:
          <div className="flex justify-center gap-4 mt-2 font-medium">
            <Link href="/registro/usuario" className="text-blue-600 hover:text-blue-800 transition">
              Registro de paciente
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/registro/profesional" className="text-purple-600 hover:text-purple-800 transition">
              Registro profesional
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
