// src/app/registro/usuario/page.js
"use client";

import { useMemo, useState } from "react";

export default function RegistroUsuarioPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    identification: "",
    birthDate: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
    interests: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Para no “molestar” con errores desde el inicio, marcamos si el usuario ya tocó/intentó enviar.
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function touch(key) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  // Debug por query param: /registro/usuario?debug=1
  const debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  // Requisitos de contraseña:
  // - mínimo 12 caracteres
  // - 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
  // - no contener el email (parte local)
  const passwordChecks = useMemo(() => {
    const pwd = form.password ?? "";
    const emailLocal = (form.email ?? "").split("@")[0]?.toLowerCase() ?? "";

    const lengthOk = pwd.length >= 12;
    const lowerOk = /[a-z]/.test(pwd);
    const upperOk = /[A-Z]/.test(pwd);
    const numberOk = /[0-9]/.test(pwd);
    const symbolOk = /[^A-Za-z0-9]/.test(pwd);
    const noEmailOk =
      emailLocal.length < 3 ? true : !pwd.toLowerCase().includes(emailLocal);

    const allOk =
      lengthOk && lowerOk && upperOk && numberOk && symbolOk && noEmailOk;

    return { lengthOk, lowerOk, upperOk, numberOk, symbolOk, noEmailOk, allOk };
  }, [form.password, form.email]);

  const passwordsMatch =
    (form.password ?? "").length > 0 &&
    (form.confirmPassword ?? "").length > 0 &&
    form.password === form.confirmPassword;

  // Helpers de validación
  const emailLooksValid = useMemo(() => {
    const v = (form.email ?? "").trim();
    if (!v) return false;
    // validación simple (HTML también valida por type="email")
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [form.email]);

  const birthDateError = useMemo(() => {
    if (!form.birthDate) return "Seleccioná tu fecha de nacimiento.";
    const birth = new Date(form.birthDate);
    if (Number.isNaN(birth.getTime())) return "Fecha de nacimiento inválida.";

    // Validación suave de rango: 1900-01-01 hasta hoy
    const min = new Date("1900-01-01");
    const max = new Date();
    max.setHours(0, 0, 0, 0);

    if (birth < min) return "Fecha de nacimiento demasiado antigua.";
    if (birth > max) return "La fecha de nacimiento no puede ser futura.";
    return "";
  }, [form.birthDate]);

  // Lista de razones que bloquean el submit (para mostrarle al usuario el “por qué”)
  const blockingReasons = useMemo(() => {
    const reasons = [];

    if (!form.name.trim()) reasons.push("Completá tu nombre.");
    if (!form.email.trim()) reasons.push("Completá tu email.");
    else if (!emailLooksValid) reasons.push("El email no parece válido.");
    if (!form.identification.trim())
      reasons.push("Completá tu identificación (DNI/Cédula/Pasaporte).");

    if (!form.phone.trim()) reasons.push("Completá tu teléfono.");

    const bdErr = birthDateError;
    if (bdErr) reasons.push(bdErr);

    if (!form.password) reasons.push("Completá tu contraseña.");
    else if (!passwordChecks.allOk)
      reasons.push("La contraseña no cumple los requisitos de seguridad.");

    if (!form.confirmPassword)
      reasons.push("Completá la confirmación de contraseña.");
    else if (!passwordsMatch)
      reasons.push("La confirmación de contraseña no coincide.");

    return reasons;
  }, [
    form.name,
    form.email,
    form.identification,
    form.birthDate,
    form.phone,
    form.password,
    form.confirmPassword,
    emailLooksValid,
    birthDateError,
    passwordChecks.allOk,
    passwordsMatch,
  ]);

  function validateBeforeSubmit() {
    // devolvemos el primer error (mensaje principal)
    return blockingReasons[0] ?? "";
  }

  const canSubmit = blockingReasons.length === 0 && !loading;

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSubmitAttempted(true);

    const preError = validateBeforeSubmit();
    if (preError) {
      setErrorMsg(preError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        identification: form.identification.trim(),
        birthDate: form.birthDate, // YYYY-MM-DD
        phone: form.phone.trim(),
        password: form.password,
        gender: form.gender?.trim() || "",
        interests: form.interests?.trim() || "",
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // si el backend no devuelve JSON, evitamos que explote
      }

      if (!res.ok) {
        // Mensaje más informativo: status + posible error
        const apiMsg =
          data?.error ||
          data?.message ||
          `Error al crear usuario (HTTP ${res.status})`;
        setErrorMsg(apiMsg);
        setLoading(false);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      setErrorMsg(
        "Error de red o del servidor. Revisá tu conexión o el endpoint /api/auth/register."
      );
      setLoading(false);
    }
  }

  // Para inputs date: max = hoy (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Mostrar panel de razones si: hay razones y (ya intentó enviar o está en debug)
  const showReasonsPanel =
    (submitAttempted || debugEnabled) && blockingReasons.length > 0;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Crear usuario</h1>

      {errorMsg ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      ) : null}

      {showReasonsPanel ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            No se puede enviar todavía. Falta corregir:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {blockingReasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            Tip: si querés ver debug completo, abrí{" "}
            <span className="font-mono">?debug=1</span> en la URL.
          </p>
        </div>
      ) : null}

      {debugEnabled ? (
        <div className="mb-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3">
          <p className="mb-2 text-sm font-semibold">Debug</p>
          <pre className="whitespace-pre-wrap text-xs text-neutral-700">
            {JSON.stringify(
              { canSubmit, loading, blockingReasons, form },
              null,
              2
            )}
          </pre>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre completo</label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            onBlur={() => touch("name")}
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
          {(touched.name || submitAttempted) && !form.name.trim() ? (
            <p className="text-xs text-red-600">Completá tu nombre.</p>
          ) : null}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            onBlur={() => touch("email")}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
          {(touched.email || submitAttempted) && form.email.trim() && !emailLooksValid ? (
            <p className="text-xs text-red-600">El email no parece válido.</p>
          ) : null}
        </div>

        {/* Identificación */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Identificación (DNI / Cédula / Pasaporte)
          </label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.identification}
            onChange={(e) => setField("identification", e.target.value)}
            onBlur={() => touch("identification")}
            placeholder="Ej: 12345678"
            autoComplete="off"
            required
          />
          {(touched.identification || submitAttempted) && !form.identification.trim() ? (
            <p className="text-xs text-red-600">
              Completá tu identificación.
            </p>
          ) : null}
        </div>

        {/* Fecha de nacimiento */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Fecha de nacimiento</label>
          <input
            type="date"
            min="1900-01-01"
            max={todayStr}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.birthDate}
            onChange={(e) => setField("birthDate", e.target.value)}
            onBlur={() => touch("birthDate")}
            required
          />
          {(touched.birthDate || submitAttempted) && birthDateError ? (
            <p className="text-xs text-red-600">{birthDateError}</p>
          ) : null}
        </div>

        {/* Teléfono */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Teléfono</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            onBlur={() => touch("phone")}
            placeholder="Ej: +506 8888 8888"
            autoComplete="tel"
            required
          />
          {(touched.phone || submitAttempted) && !form.phone.trim() ? (
            <p className="text-xs text-red-600">Completá tu teléfono.</p>
          ) : null}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Contraseña</label>
          <div className="flex gap-2">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              onBlur={() => touch("password")}
              placeholder="Mínimo 12 caracteres"
              autoComplete="new-password"
              required
              aria-describedby="password-help"
            />
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          {(touched.password || submitAttempted) && form.password && !passwordChecks.allOk ? (
            <p className="text-xs text-red-600">
              La contraseña no cumple los requisitos.
            </p>
          ) : null}

          <div
            id="password-help"
            className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          >
            <p className="mb-2 text-xs font-medium text-neutral-700">
              Requisitos de seguridad
            </p>
            <ul className="space-y-1 text-xs">
              <li
                className={
                  passwordChecks.lengthOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • Mínimo 12 caracteres
              </li>
              <li
                className={
                  passwordChecks.lowerOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • Al menos 1 letra minúscula
              </li>
              <li
                className={
                  passwordChecks.upperOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • Al menos 1 letra mayúscula
              </li>
              <li
                className={
                  passwordChecks.numberOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • Al menos 1 número
              </li>
              <li
                className={
                  passwordChecks.symbolOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • Al menos 1 símbolo (ej: !@#$)
              </li>
              <li
                className={
                  passwordChecks.noEmailOk ? "text-green-700" : "text-neutral-600"
                }
              >
                • No debe contener tu email
              </li>
            </ul>
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Confirmar contraseña</label>
          <div className="flex gap-2">
            <input
              type={showConfirm ? "text" : "password"}
              className={
                "w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-1 " +
                (form.confirmPassword.length === 0
                  ? "border-neutral-300 focus:border-brand-600 focus:ring-brand-600"
                  : passwordsMatch
                  ? "border-green-400 focus:border-green-500 focus:ring-green-500"
                  : "border-red-300 focus:border-red-500 focus:ring-red-500")
              }
              value={form.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              onBlur={() => touch("confirmPassword")}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? "Ocultar" : "Ver"}
            </button>
          </div>

          {(touched.confirmPassword || submitAttempted) &&
          form.confirmPassword.length > 0 &&
          !passwordsMatch ? (
            <p className="text-xs text-red-600">La confirmación no coincide.</p>
          ) : null}
        </div>

        <hr className="my-2" />

        {/* Género */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Género (opcional)</label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.gender}
            onChange={(e) => setField("gender", e.target.value)}
            placeholder="Escribí lo que quieras"
          />
        </div>

        {/* Intereses */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Intereses relacionados a salud mental (opcional)
          </label>
          <textarea
            rows={4}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.interests}
            onChange={(e) => setField("interests", e.target.value)}
            placeholder="Escribí lo que quieras, con tus propias palabras."
          />
          <p className="text-xs text-neutral-500">
            Esta información es opcional y puede modificarse más adelante.
          </p>
        </div>

        {/* BOTÓN BRAND */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="
            w-full
            rounded-lg
            bg-brand-600
            px-4
            py-2
            font-semibold
            text-white
            transition
            hover:bg-brand-700
            focus:outline-none
            focus:ring-2
            focus:ring-brand-600
            focus:ring-offset-2
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loading ? "Creando..." : "Crear usuario"}
        </button>

        {/* Mensaje explícito cuando el botón está deshabilitado */}
        {!canSubmit && !loading ? (
          <p className="text-xs text-neutral-600">
            El botón está deshabilitado porque aún hay datos inválidos o incompletos. Revisá el recuadro de arriba.
          </p>
        ) : null}

        <p className="text-xs text-neutral-500">
          Consejo: usá una contraseña única (idealmente una frase larga) y no la
          reutilices en otros sitios.
        </p>
      </form>
    </main>
  );
}
