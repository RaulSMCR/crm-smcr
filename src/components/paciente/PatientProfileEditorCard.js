// src/components/paciente/PatientProfileEditorCard.js
"use client";

import { useCallback, useState, useTransition } from "react";
import { updatePatientProfile, updateInsuranceInfo } from "@/actions/patient-profile-actions";
import Toast from "@/components/ui/Toast";

export default function PatientProfileEditorCard({ user }) {
  const [isPending, startTransition] = useTransition();
  const [insurancePending, startInsuranceTransition] = useTransition();
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    identification: user?.identification || "",
    birthDate: user?.birthDate || "",
    gender: user?.gender || "",
    interests: user?.interests || "",
  });

  const [insurance, setInsurance] = useState({
    hasInsurance: user?.hasInsurance ?? false,
    useInsuranceForPayment: user?.useInsuranceForPayment ?? false,
    insuranceName: user?.insuranceName || "",
  });

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("phone", form.phone);
    fd.append("identification", form.identification);
    fd.append("birthDate", form.birthDate);
    fd.append("gender", form.gender);
    fd.append("interests", form.interests);

    startTransition(async () => {
      const res = await updatePatientProfile(fd);
      if (res?.error) setToast({ message: res.error, type: "error" });
      else setToast({ message: "Perfil actualizado correctamente.", type: "success" });
    });
  }

  function onInsuranceSubmit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("hasInsurance", String(insurance.hasInsurance));
    fd.append("useInsuranceForPayment", String(insurance.useInsuranceForPayment));
    fd.append("insuranceName", insurance.insuranceName);

    startInsuranceTransition(async () => {
      const res = await updateInsuranceInfo(fd);
      if (res?.error) setToast({ message: res.error, type: "error" });
      else setToast({ message: "Información de seguro guardada.", type: "success" });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900">Mi perfil</h2>
      <p className="text-sm text-slate-600 mt-1">Actualice sus datos personales para mantener una atención segura.</p>

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

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />

      {/* ── Sección de seguro médico ── */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-bold text-slate-900">Seguro médico</h3>
        <p className="text-sm text-slate-500 mt-1">
          Indique si tiene seguro médico y si planea usarlo para el pago de consultas.
        </p>

        <form onSubmit={onInsuranceSubmit} className="mt-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={insurance.hasInsurance}
              onChange={(e) =>
                setInsurance((p) => ({
                  ...p,
                  hasInsurance: e.target.checked,
                  useInsuranceForPayment: e.target.checked ? p.useInsuranceForPayment : false,
                  insuranceName: e.target.checked ? p.insuranceName : "",
                }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm font-medium text-slate-700">Tengo seguro médico</span>
          </label>

          {insurance.hasInsurance && (
            <label className="flex items-center gap-3 cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={insurance.useInsuranceForPayment}
                onChange={(e) =>
                  setInsurance((p) => ({
                    ...p,
                    useInsuranceForPayment: e.target.checked,
                    insuranceName: e.target.checked ? p.insuranceName : "",
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">
                Planeo pagar mis consultas con seguro o solicitar reembolso
              </span>
            </label>
          )}

          {insurance.hasInsurance && insurance.useInsuranceForPayment && (
            <div className="ml-4">
              <label className="block text-sm font-medium text-slate-700">
                Nombre del seguro médico
              </label>
              <input
                type="text"
                value={insurance.insuranceName}
                onChange={(e) => setInsurance((p) => ({ ...p, insuranceName: e.target.value }))}
                placeholder="Ej: CCSS, INS, Surexs, etc."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={insurancePending}
            className="rounded-xl bg-slate-800 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-900 disabled:opacity-60"
          >
            {insurancePending ? "Guardando..." : "Guardar información de seguro"}
          </button>
        </form>
      </div>
    </div>
  );
}
