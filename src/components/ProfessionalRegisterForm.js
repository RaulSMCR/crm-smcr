// src/components/ProfessionalRegisterForm.js
"use client";

import { useMemo, useState } from "react";

const INITIAL_FORM = {
  nombreCompleto: "",
  profesion: "",
  email: "",
  telefono: "",
  password: "",
  confirmPassword: "",
  cv: null,
  carta: null,
};

export default function ProfessionalRegisterForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  /* --------------------------------------------------
     PASSWORD VALIDATION (UX fuerte, backend manda igual)
  -------------------------------------------------- */

  const passwordChecks = useMemo(() => {
    const pwd = formData.password ?? "";
    const emailLocal =
      (formData.email ?? "").split("@")[0]?.toLowerCase() ?? "";

    const lengthOk = pwd.length >= 12;
    const lowerOk = /[a-z]/.test(pwd);
    const upperOk = /[A-Z]/.test(pwd);
    const numberOk = /[0-9]/.test(pwd);
    const symbolOk = /[^A-Za-z0-9]/.test(pwd);
    const noEmailOk =
      emailLocal.length < 3
        ? true
        : !pwd.toLowerCase().includes(emailLocal);

    const allOk =
      lengthOk &&
      lowerOk &&
      upperOk &&
      numberOk &&
      symbolOk &&
      noEmailOk;

    return {
      lengthOk,
      lowerOk,
      upperOk,
      numberOk,
      symbolOk,
      noEmailOk,
      allOk,
    };
  }, [formData.password, formData.email]);

  const passwordsMatch =
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword;

  const canSubmit =
    formData.nombreCompleto.trim() &&
    formData.profesion.trim() &&
    formData.email.trim() &&
    passwordChecks.allOk &&
    passwordsMatch &&
    !loading;

  /* --------------------------------------------------
     HANDLERS
  -------------------------------------------------- */

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  }

  function handleFileChange(e) {
    const { name, files } = e.target;
    setFormData((p) => ({ ...p, [name]: files?.[0] ?? null }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!canSubmit) {
      setMessage({
        type: "error",
        text: "Revisá los campos y los requisitos de contraseña.",
      });
      return;
    }

    setLoading(true);

    try {
      // ⚠️ Backend hoy recibe JSON
      // 👉 Cuando haya upload real: FormData + storage
      const payload = {
        nombreCompleto: formData.nombreCompleto.trim(),
        profesion: formData.profesion.trim(),
        email: formData.email.trim().toLowerCase(),
        telefono: formData.telefono.trim() || "",
        password: formData.password,
      };

      const response = await fetch("/api/auth/register-professional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          setMessage({
            type: "error",
            text: "Este email ya está registrado.",
          });
          return;
        }

        if (response.status === 422 && data?.error) {
          setMessage({
            type: "error",
            text: data.error,
          });
          return;
        }

        setMessage({
          type: "error",
          text: data?.error || "No se pudo enviar la solicitud.",
        });
        return;
      }

      setMessage({
        type: "success",
        text:
          "Solicitud enviada. Verificá tu email. Un administrador te contactará para continuar el proceso.",
      });

      setFormData(INITIAL_FORM);
    } catch {
      setMessage({
        type: "error",
        text: "Error de red o servidor. Intentalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-brand-800">
        Registro de Profesionales
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        Completá el formulario para que el equipo pueda revisar y aprobar tu
        perfil.
      </p>

      {message.text && (
        <div
          className={
            "mb-4 rounded-lg border p-3 text-sm " +
            (message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium">Nombre completo</label>
            <input
              type="text"
              name="nombreCompleto"
              value={formData.nombreCompleto}
              onChange={handleChange}
              required
              autoComplete="name"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Profesión</label>
            <input
              type="text"
              name="profesion"
              value={formData.profesion}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Teléfono (opcional)</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              autoComplete="tel"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
          />

          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-700">
              Requisitos de seguridad
            </p>
            <ul className="space-y-1 text-xs">
              <PasswordItem ok={passwordChecks.lengthOk} text="Mínimo 12 caracteres" />
              <PasswordItem ok={passwordChecks.lowerOk} text="Al menos 1 minúscula" />
              <PasswordItem ok={passwordChecks.upperOk} text="Al menos 1 mayúscula" />
              <PasswordItem ok={passwordChecks.numberOk} text="Al menos 1 número" />
              <PasswordItem ok={passwordChecks.symbolOk} text="Al menos 1 símbolo" />
              <PasswordItem ok={passwordChecks.noEmailOk} text="No contener el email" />
            </ul>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Confirmar contraseña</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
            className={
              "w-full rounded-lg border px-3 py-2 focus:ring-1 " +
              (formData.confirmPassword.length === 0
                ? "border-neutral-300 focus:border-brand-600 focus:ring-brand-600"
                : passwordsMatch
                ? "border-green-400 focus:border-green-500 focus:ring-green-500"
                : "border-red-300 focus:border-red-500 focus:ring-red-500")
            }
          />
          {formData.confirmPassword && !passwordsMatch && (
            <p className="text-xs text-red-600">La confirmación no coincide.</p>
          )}
        </div>

        <hr />

        <div className="grid gap-4 sm:grid-cols-2">
          <FileInput
            label="CV (PDF)"
            name="cv"
            onChange={handleFileChange}
          />
          <FileInput
            label="Carta de presentación (PDF)"
            name="carta"
            onChange={handleFileChange}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>

        <p className="text-xs text-neutral-500">
          Tu perfil quedará en estado <b>Pendiente</b> hasta aprobación.
        </p>
      </form>
    </div>
  );
}

/* --------------------------------------------------
   SUBCOMPONENTES
-------------------------------------------------- */

function PasswordItem({ ok, text }) {
  return (
    <li className={ok ? "text-green-700" : "text-neutral-600"}>
      • {text}
    </li>
  );
}

function FileInput({ label, name, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}{" "}
        <span className="text-xs text-neutral-500">(próximamente)</span>
      </label>
      <input
        type="file"
        name={name}
        accept=".pdf"
        onChange={onChange}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2"
      />
    </div>
  );
}
