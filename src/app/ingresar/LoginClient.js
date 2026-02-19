// src/app/ingresar/LoginClient.js

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/actions/auth-actions";
import Link from "next/link";

function safeNextPath(nextValue) {
  // Solo permitimos rutas relativas internas para evitar open-redirect
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

  // ✅ NUEVO: detecta tipo de registro para mostrar mensaje correcto
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

    setError("No se pudo iniciar sesión. Intenta de nuevo.");
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6"
      >
        <div className="text-center pb-4 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
          <p className="text-sm text-gray-500 mt-1">Accede a tu cuenta de Salud Mental CR</p>
        </div>

        {/* ✅ MENSAJE POST-REGISTRO PROFESIONAL (2 PASOS + LLAMADA) */}
        {isProfessionalRegistered && (
          <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm border border-green-200 font-medium">
            <div className="flex items-center gap-2">
              ✅ <span className="font-bold">Solicitud profesional enviada con éxito</span>
            </div>

            <p className="mt-2 text-green-900">
              Tu proceso tiene <span className="font-bold">2 pasos</span>:
            </p>

            <ol className="mt-2 list-decimal list-inside space-y-1">
              <li>
                <span className="font-semibold">Verificación por correo:</span> revisa tu email (y carpeta de spam)
                para confirmar tu cuenta.
              </li>
              <li>
                <span className="font-semibold">Entrevista y aprobación:</span> luego, el{" "}
                <span className="font-bold">director del equipo profesional</span> te estará{" "}
                <span className="font-bold">llamando</span> al teléfono/WhatsApp que registraste para una breve
                entrevista y finalizar la aprobación.
              </li>
            </ol>

            <p className="mt-2 text-xs text-green-800">
              Mientras se completa el paso 2, tu perfil puede aparecer como <span className="font-semibold">“en revisión”</span>.
            </p>
          </div>
        )}

        {/* ✅ MENSAJE POST-REGISTRO GENÉRICO (PACIENTE / OTROS) */}
        {!isProfessionalRegistered && isGenericRegistered && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200 font-medium flex items-center gap-2">
            ✅ ¡Cuenta creada con éxito! Revisa tu correo para verificarla y luego inicia sesión.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 font-medium flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="tu@email.com"
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
                ¿Olvidaste tu contraseña?
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
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Ingresando...
              </span>
            ) : (
              "Ingresar al Portal"
            )}
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 mt-6 pt-4 border-t border-gray-100">
          ¿No tienes cuenta?{" "}
          <div className="flex justify-center gap-4 mt-2 font-medium">
            <Link href="/registro/usuario" className="text-blue-600 hover:text-blue-800 transition">
              Soy Paciente
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/registro/profesional" className="text-purple-600 hover:text-purple-800 transition">
              Soy Profesional
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
