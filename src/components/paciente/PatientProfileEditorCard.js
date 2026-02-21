// src/components/paciente/PatientProfileEditorCard.js
"use client";

import { useState, useTransition } from "react";
import { updatePatientProfile } from "@/actions/patient-profile-actions";

export default function PatientProfileEditorCard({ user }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState(null);

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    identification: user?.identification || "",
    birthDate: user?.birthDate || "",
    gender: user?.gender || "",
    interests: user?.interests || "",
  });

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("phone", form.phone);
    fd.append("identification", form.identification);
    fd.append("birthDate", form.birthDate);
    fd.append("gender", form.gender);
    fd.append("interests", form.interests);

    startTransition(async () => {
      const res = await updatePatientProfile(fd);
      if (res?.error) setMsg({ type: "error", text: res.error });
      else setMsg({ type: "ok", text: "✅ Perfil actualizado." });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900">Mi perfil</h2>
      <p className="text-sm text-slate-600 mt-1">Actualiza tus datos personales.</p>

      {msg && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            value={form.email}
            disabled
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Teléfono</label>
          <input
            name="phone"
            value={form.phone}
            onChange={onChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Identificación / Cédula</label>
          <input
            name="identification"
            value={form.identification}
            onChange={onChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <p className="mt-1 text-xs text-slate-500">Tal como aparece en tu documento.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha de nacimiento</label>
          <input
            type="date"
            name="birthDate"
            value={form.birthDate}
            onChange={onChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Género</label>
          <select
            name="gender"
            value={form.gender}
            onChange={onChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="">—</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="O">Otro</option>
            <option value="N">Prefiero no decir</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Intereses</label>
          <textarea
            name="interests"
            value={form.interests}
            onChange={onChange}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="Ansiedad, terapia de pareja, nutrición, etc."
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
