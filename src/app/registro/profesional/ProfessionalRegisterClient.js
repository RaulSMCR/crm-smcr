"use client";

import { useState } from "react";

export default function ProfessionalRegisterForm() {
  const [form, setForm] = useState({
    nombreCompleto: "",
    profesion: "",
    email: "",
    telefono: "",
    password: "",
    confirmPassword: "",
    avatarUrl: "",
    resumeUrl: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const requiredOk =
    form.nombreCompleto.trim() &&
    form.profesion.trim() &&
    form.email.trim() &&
    form.password;

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccess(false);

    if (!form.nombreCompleto.trim() || !form.profesion.trim() || !form.email.trim()) {
      setErrorMsg("Completá nombre, profesión y email.");
      return;
    }

    const email = String(form.email).trim().toLowerCase();
    if (!email.includes("@")) {
      setErrorMsg("Ingresá un email válido.");
      return;
    }

    if (!form.password || form.password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const r = await fetch("/api/auth/register-professional", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombreCompleto: form.nombreCompleto.trim(),
          profesion: form.profesion.trim(),
          email,
          telefono: form.telefono ? String(form.telefono).trim() : "",
          password: form.password,
          avatarUrl: form.avatarUrl.trim() ? form.avatarUrl.trim() : null,
          resumeUrl: form.resumeUrl.trim() ? form.resumeUrl.trim() : null,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        // tus endpoints devuelven { error: "..."}
        setErrorMsg(data?.error || "No se pudo enviar la solicitud.");
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMsg("Error de red. Probá más tarde.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="rounded-xl border bg-white p-6 space-y-3">
        <h2 className="text-lg font-semibold text-green-700">Solicitud recibida ✅</h2>

        <p>
          Te enviamos un email para <strong>verificar tu correo</strong>.
        </p>

        <p>
          Además, <strong>un administrador te contactará</strong> para agendar una entrevista.
        </p>

        <p className="text-sm text-neutral-700">
          Tu perfil <strong>no estará visible</strong> en la plataforma hasta que sea validado.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-white p-6 space-y-3">
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Nombre completo *"
        value={form.nombreCompleto}
        onChange={(e) => setField("nombreCompleto", e.target.value)}
        autoComplete="name"
      />

      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Profesión *"
        value={form.profesion}
        onChange={(e) => setField("profesion", e.target.value)}
      />

      <input
        type="email"
        className="w-full rounded-md border px-3 py-2"
        placeholder="Email *"
        value={form.email}
        onChange={(e) => setField("email", e.target.value)}
        autoComplete="email"
      />

      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Teléfono"
        value={form.telefono}
        onChange={(e) => setField("telefono", e.target.value)}
        autoComplete="tel"
      />

      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="URL de foto (opcional)"
        value={form.avatarUrl}
        onChange={(e) => setField("avatarUrl", e.target.value)}
      />

      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="URL del CV/Resume (opcional)"
        value={form.resumeUrl}
        onChange={(e) => setField("resumeUrl", e.target.value)}
      />

      <input
        type="password"
        className="w-full rounded-md border px-3 py-2"
        placeholder="Contraseña (mín. 8) *"
        value={form.password}
        onChange={(e) => setField("password", e.target.value)}
        autoComplete="new-password"
      />

      <input
        type="password"
        className="w-full rounded-md border px-3 py-2"
        placeholder="Confirmar contraseña *"
        value={form.confirmPassword}
        onChange={(e) => setField("confirmPassword", e.target.value)}
        autoComplete="new-password"
      />

      {errorMsg && (
        <p className="text-sm text-red-600 rounded border border-red-200 bg-red-50 px-3 py-2">
          {errorMsg}
        </p>
      )}

      <button
        disabled={loading || !requiredOk}
        className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "Enviando..." : "Enviar solicitud"}
      </button>

      <p className="text-xs text-neutral-500">* Campos obligatorios.</p>
    </form>
  );
}
