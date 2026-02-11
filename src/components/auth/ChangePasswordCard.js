// PATH: src/components/auth/ChangePasswordCard.js
"use client";

import { useState } from "react";

export default function ChangePasswordCard({ title = "Cambiar contraseña" }) {
  const [pw, setPw] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!pw.currentPassword) {
      setMsg({ type: "error", text: "Debes ingresar tu contraseña actual." });
      return;
    }
    if (!pw.newPassword || pw.newPassword.length < 8) {
      setMsg({ type: "error", text: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      setMsg({ type: "error", text: "La confirmación no coincide." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pw),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "error", text: data?.error || "No se pudo actualizar la contraseña." });
        return;
      }

      setMsg({ type: "success", text: data?.message || "Contraseña actualizada." });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setMsg({ type: "error", text: "Error de red. Intenta de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-6">
        Para tu seguridad, debes ingresar tu contraseña actual.
      </p>

      {msg.text && (
        <div
          className={`mb-4 p-4 rounded-lg font-medium text-center ${
            msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña actual</label>
          <input
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nueva</label>
          <input
            type="password"
            value={pw.confirmPassword}
            onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div className="md:col-span-3 flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow hover:bg-black transition ${
              loading ? "opacity-70 cursor-wait" : ""
            }`}
          >
            {loading ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
