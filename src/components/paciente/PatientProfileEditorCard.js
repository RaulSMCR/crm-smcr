// src/components/paciente/PatientProfileEditorCard.js
"use client";

import { useState, useTransition } from "react";
import { updatePatientProfile } from "@/actions/patient-profile-actions";

export default function PatientProfileEditorCard({ user }) {
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    identification: user?.identification || "",
    birthDate: user?.birthDate || "",
    gender: user?.gender || "",
    interests: user?.interests || "",
  });

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSave = (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("phone", form.phone);
    fd.append("identification", form.identification);
    fd.append("birthDate", form.birthDate);
    fd.append("gender", form.gender);
    fd.append("interests", form.interests);

    startTransition(async () => {
      const res = await updatePatientProfile(fd);
      if (res?.success) setMsg({ type: "success", text: "✅ Perfil actualizado." });
      else setMsg({ type: "error", text: "❌ " + (res?.error || "No se pudo actualizar.") });
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900">Mi información</h2>
      <p className="text-sm text-slate-600 mt-1">Edita tus datos para tus citas y contacto.</p>

      {msg.text && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            msg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={onSave} className="mt-4 grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Nombre</label>
          <input name="name" value={form.name} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Teléfono</label>
          <input name="phone" value={form.phone} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Identificación</label>
          <input name="identification" value={form.identification} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Fecha de nacimiento</label>
          <input type="date" name="birthDate" value={form.birthDate} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Género</label>
          <input name="gender" value={form.gender} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Intereses</label>
          <input name="interests" value={form.interests} onChange={onChange} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button disabled={isPending} className="rounded-xl bg-slate-900 text-white px-5 py-2.5 font-semibold hover:bg-slate-800 disabled:opacity-60">
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
