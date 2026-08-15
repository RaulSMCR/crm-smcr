// src/components/paciente/PatientProfileEditorCard.js
"use client";

import { useCallback, useState, useTransition } from "react";
import { updatePatientProfile, updateInsuranceInfo, updateBillingInfo } from "@/actions/patient-profile-actions";
import { ETIQUETAS_IDENTIFICACION } from "@/lib/fiscal-identity";
import Toast from "@/components/ui/Toast";

export default function PatientProfileEditorCard({ user }) {
  const [isPending, startTransition] = useTransition();
  const [insurancePending, startInsuranceTransition] = useTransition();
  const [billingPending, startBillingTransition] = useTransition();
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

  // Vacíos por defecto: la mayoría factura a nombre propio y no toca esto.
  const [billing, setBilling] = useState({
    billingName: user?.billingName || "",
    billingIdType: user?.billingIdType || "",
    billingIdNumber: user?.billingIdNumber || "",
    billingEmail: user?.billingEmail || "",
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

  function onBillingSubmit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("billingName", billing.billingName);
    fd.append("billingIdType", billing.billingIdType);
    fd.append("billingIdNumber", billing.billingIdNumber);
    fd.append("billingEmail", billing.billingEmail);

    startBillingTransition(async () => {
      const res = await updateBillingInfo(fd);
      if (res?.error) setToast({ message: res.error, type: "error" });
      else if (res?.cleared)
        setToast({ message: "Sus facturas volverán a emitirse a su nombre.", type: "success" });
      else setToast({ message: "Datos de facturación guardados.", type: "success" });
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

      {/* ── Datos de facturación ── */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-bold text-slate-900">Datos de facturación</h3>
        <p className="mt-1 text-sm text-slate-500">
          Solo si necesita la factura a nombre de una empresa para deducirla del impuesto sobre
          la renta. Si lo deja vacío, la factura sale a su nombre con la cédula de su cuenta.
        </p>

        <form onSubmit={onBillingSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="billingName" className="block text-sm font-medium text-slate-700">
              Nombre o razón social
            </label>
            <input
              id="billingName"
              type="text"
              value={billing.billingName}
              onChange={(e) => setBilling((p) => ({ ...p, billingName: e.target.value }))}
              placeholder="Tal como aparece en el registro de Hacienda"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="billingIdType" className="block text-sm font-medium text-slate-700">
                Tipo de identificación
              </label>
              <select
                id="billingIdType"
                value={billing.billingIdType}
                onChange={(e) => setBilling((p) => ({ ...p, billingIdType: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Seleccione…</option>
                {Object.entries(ETIQUETAS_IDENTIFICACION).map(([codigo, etiqueta]) => (
                  <option key={codigo} value={codigo}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="billingIdNumber" className="block text-sm font-medium text-slate-700">
                Número
              </label>
              <input
                id="billingIdNumber"
                type="text"
                inputMode="numeric"
                value={billing.billingIdNumber}
                onChange={(e) => setBilling((p) => ({ ...p, billingIdNumber: e.target.value }))}
                placeholder="Solo dígitos, sin guiones"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="billingEmail" className="block text-sm font-medium text-slate-700">
              Correo para recibir la factura <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="billingEmail"
              type="email"
              value={billing.billingEmail}
              onChange={(e) => setBilling((p) => ({ ...p, billingEmail: e.target.value }))}
              placeholder={user?.email || "contabilidad@empresa.com"}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-500">
              Si lo deja vacío, la factura llega al correo de su cuenta.
            </p>
          </div>

          <button
            type="submit"
            disabled={billingPending}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {billingPending ? "Guardando..." : "Guardar datos de facturación"}
          </button>

          <p className="text-xs text-slate-500">
            Estos datos se usan en las facturas que se emitan de aquí en adelante. Las ya emitidas
            no cambian: una factura electrónica no se puede modificar, solo anular con una nota de
            crédito.
          </p>
        </form>
      </div>
    </div>
  );
}
