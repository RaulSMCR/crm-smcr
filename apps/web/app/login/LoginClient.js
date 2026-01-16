// apps/web/app/login/LoginClient.js
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  // Leer directo del DOM (evita problemas con autocompletar que no disparan onChange)
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  function safeNextPath(raw) {
    // Solo permitimos rutas internas (evita open redirect)
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s.startsWith("/")) return null;
    if (s.startsWith("//")) return null;
    return s;
  }

  async function doLogin() {
    setError(null);

    const email = String(emailRef.current?.value || "")
      .trim()
      .toLowerCase();
    const password = String(passwordRef.current?.value || "");

    if (!email || !password) {
      setError("Ingresá email y contraseña.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `Error ${res.status}`);
      }

      // Prioridad: ?next= si es ruta interna segura
      const nextParam = safeNextPath(searchParams?.get("next"));
      let to = nextParam || "/";

      // Si no hay next, redirigimos según rol
      if (!nextParam) {
        if (data.role === "ADMIN") to = "/admin";
        else if (data.role === "PROFESSIONAL") to = "/dashboard-profesional";
        else to = "/dashboard";
      }

      startTransition(() => {
        router.push(to);
        router.refresh();
      });
    } catch (err) {
      setError(err?.message || "Error al iniciar sesión");
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      doLogin();
    }
  }

  return (
    <main
      className="min-h-[70vh] flex items-center justify-center px-4"
      onKeyDown={onKeyDown}
    >
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Ingresar
        </h1>

        <div className="max-w-sm w-full space-y-4 mx-auto">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              ref={emailRef}
              autoComplete="email"
              className="w-full border rounded px-3 py-2"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              ref={passwordRef}
              autoComplete="current-password"
              className="w-full border rounded px-3 py-2"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={doLogin}
            disabled={pending}
            className="w-full px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-70"
          >
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          ¿No tenés cuenta?{" "}
          <a
            href="/registro/usuario"
            className="text-accent-300 underline"
          >
            Crear cuenta usuario
          </a>{" "}
          |{" "}
          <a
            href="/registro/profesional"
            className="text-accent-300 underline"
          >
            Quiero ser profesional
          </a>
        </p>
      </div>
    </main>
  );
}
