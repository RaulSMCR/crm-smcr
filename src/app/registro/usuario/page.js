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

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Requisitos de contraseña (baseline razonable):
  // - mínimo 12 caracteres
  // - al menos 1 mayúscula, 1 minúscula, 1 número y 1 símbolo
  // - no contener el email (parte local) como string
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

  function validateBeforeSubmit() {
    if (!form.name.trim()) return "Completá tu nombre.";
    if (!form.email.trim()) return "Completá tu email.";
    if (!form.identification.trim())
      return "Completá tu identificación (DNI/Cédula/Pasaporte).";
    if (!form.birthDate) return "Seleccioná tu fecha de nacimiento.";
    if (!form.phone.trim()) return "Completá tu teléfono.";
    if (!passwordChecks.allOk)
      return "La contraseña no cumple los requisitos de seguridad.";
    if (!passwordsMatch) return "La confirmación de contraseña no coincide.";

    // Validación suave de fecha
    const birth = new Date(form.birthDate);
    if (Number.isNaN(birth.getTime()))
      return "Fecha de nacimiento inválida.";

    return "";
  }

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.identification.trim() &&
    form.birthDate &&
    form.phone.trim() &&
    passwordChecks.allOk &&
    passwordsMatch &&
    !loading;

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    const preError = validateBeforeSubmit();
    if (preError) {
      setErrorMsg(preError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        identification: form.identification,
        birthDate: form.birthDate, // YYYY-MM-DD
        phone: form.phone,
        password: form.password,
        gender: form.gender,
        interests: form.interests,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error ?? "Error al crear usuario");
        setLoading(false);
        return;
      }

      // Éxito: ajustá según tu app (ej: /dashboard)
      window.location.href = "/";
    } catch (err) {
      setErrorMsg("Error de red o del servidor");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Crear usuario</h1>

      {errorMsg ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMsg}</p>
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
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
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
            placeholder="Ej: 12345678"
            autoComplete="off"
            required
          />
        </div>

        {/* Fecha de nacimiento */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Fecha de nacimiento</label>
          <input
            type="date"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.birthDate}
            onChange={(e) => setField("birthDate", e.target.value)}
            required
          />
        </div>

        {/* Teléfono */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Teléfono</label>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="Ej: +506 8888 8888"
            autoComplete="tel"
            required
          />
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

          <div
            id="password-help"
            className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          >
            <p className="mb-2 text-xs font-medium text-neutral-700">
              Requisitos de seguridad
            </p>
            <ul className="space-y-1 text-xs">
              <li className={passwordChecks.lengthOk ? "text-green-700" : "text-neutral-600"}>
                • Mínimo 12 caracteres
              </li>
              <li className={passwordChecks.lowerOk ? "text-green-700" : "text-neutral-600"}>
                • Al menos 1 letra minúscula
              </li>
              <li className={passwordChecks.upperOk ? "text-green-700" : "text-neutral-600"}>
                • Al menos 1 letra mayúscula
              </li>
              <li className={passwordChecks.numberOk ? "text-green-700" : "text-neutral-600"}>
                • Al menos 1 número
              </li>
              <li className={passwordChecks.symbolOk ? "text-green-700" : "text-neutral-600"}>
                • Al menos 1 símbolo (ej: !@#$)
              </li>
              <li className={passwordChecks.noEmailOk ? "text-green-700" : "text-neutral-600"}>
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

          {form.confirmPassword.length > 0 && !passwordsMatch ? (
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

        <p className="text-xs text-neutral-500">
          Consejo: usá una contraseña única (idealmente una frase larga) y no la reutilices en otros sitios.
        </p>
      </form>
    </main>
  );
}
