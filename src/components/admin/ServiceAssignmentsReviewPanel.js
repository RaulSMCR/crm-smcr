"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkReviewServiceAssignments, reviewServiceAssignment } from "@/actions/service-actions";
import Link from "next/link";
import Toast from "@/components/ui/Toast";

function statusBadge(status) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default function ServiceAssignmentsReviewPanel({
  serviceId,
  assignments,
  taxes = [],
  cabysCode: initialCabys = "",
  taxId: initialTaxId = "",
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);

  const [edits, setEdits] = useState(() => {
    const base = {};
    for (const a of assignments) {
      base[a.professional.id] = { adminReviewNote: a.adminReviewNote ?? "" };
    }
    return base;
  });

  // Clasificacion fiscal del SERVICIO, no de cada asignacion: es el dato que
  // Hacienda exige y se fija al aprobar, que es cuando el servicio pasa a cobrarse.
  // Los servicios de salud llevan IVA reducido del 4%. Se preselecciona para que
  // sea el camino corto y se avisa si se elige otra cosa, porque un 13% acá
  // significa cobrarle de más al paciente y declarar mal ante Hacienda.
  const ivaSalud = useMemo(() => taxes.find((tax) => Number(tax.rate) === 4), [taxes]);

  const [fiscal, setFiscal] = useState({
    cabysCode: initialCabys || "",
    taxId: initialTaxId || ivaSalud?.id || "",
  });

  const fiscalIncompleto = !fiscal.cabysCode.trim() || !fiscal.taxId;
  const tasaElegida = taxes.find((tax) => tax.id === fiscal.taxId);
  const tasaNoEsSalud = Boolean(tasaElegida) && Number(tasaElegida.rate) !== 4;

  const dismissToast = useCallback(() => setToast(null), []);

  const pendingAssignments = useMemo(
    () => assignments.filter((a) => a.status === "PENDING"),
    [assignments]
  );

  const setField = (professionalId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [professionalId]: { ...(prev[professionalId] || {}), [field]: value },
    }));
  };

  const handleReview = (professionalId, decision) => {
    setToast(null);
    const payload = edits[professionalId] || {};
    startTransition(async () => {
      const res = await reviewServiceAssignment(serviceId, professionalId, { ...payload, decision, ...fiscal });
      if (res?.success) {
        setToast({ message: "Solicitud actualizada correctamente.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: res?.error || "No se pudo actualizar la solicitud.", type: "error" });
      }
    });
  };

  const handleBulk = (decision) => {
    if (pendingAssignments.length === 0) return;
    setToast(null);
    const updates = pendingAssignments.map((a) => ({
      professionalId: a.professional.id,
      decision,
      adminReviewNote: edits[a.professional.id]?.adminReviewNote,
      ...fiscal,
    }));
    startTransition(async () => {
      const res = await bulkReviewServiceAssignments(serviceId, updates);
      if (res?.success) {
        setToast({
          message: decision === "APPROVED" ? "Se aprobaron las solicitudes pendientes." : "Se rechazaron las solicitudes pendientes.",
          type: "success",
        });
        router.refresh();
      } else {
        setToast({ message: res?.error || "No se pudo ejecutar la revisión masiva.", type: "error" });
      }
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div
          className={`rounded-xl border p-4 ${
            fiscalIncompleto ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="text-sm font-semibold text-slate-900">Clasificación fiscal del servicio</div>
          <p className="mt-1 text-xs text-slate-600">
            {fiscalIncompleto
              ? "Falta clasificar el servicio. Sin CABYS e IVA no se puede aprobar a ningún profesional: sus facturas saldrían incompletas ante Hacienda."
              : "El servicio está clasificado. Estos valores se aplican a las facturas de todos los profesionales que lo brindan."}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-slate-800">Código CABYS</span>
              <input
                value={fiscal.cabysCode}
                onChange={(e) => setFiscal((prev) => ({ ...prev, cabysCode: e.target.value }))}
                inputMode="numeric"
                pattern="[0-9]{13}"
                maxLength={13}
                placeholder="13 dígitos"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-slate-800">IVA</span>
              <select
                value={fiscal.taxId}
                onChange={(e) => setFiscal((prev) => ({ ...prev, taxId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Seleccione…</option>
                {taxes.map((tax) => (
                  <option key={tax.id} value={tax.id}>
                    {tax.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tasaNoEsSalud && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              Seleccionó IVA {String(tasaElegida.rate)}%. Los servicios de salud llevan el 4% reducido.
              Confirme que este servicio realmente queda fuera de esa categoría antes de aprobar.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Pendientes: <b>{pendingAssignments.length}</b>
            <span className="ml-3 text-xs text-slate-500">
              Aprobar habilita al profesional a brindar el servicio. Los precios se revisan aparte en{" "}
              <Link href="/panel/admin/tarifas" className="font-medium text-blue-700 hover:underline">
                Tarifas
              </Link>
              .
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || pendingAssignments.length === 0 || fiscalIncompleto}
              title={fiscalIncompleto ? "Clasifique el servicio antes de aprobar" : undefined}
              onClick={() => handleBulk("APPROVED")}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
            >
              Aprobar pendientes
            </button>
            <button
              type="button"
              disabled={isPending || pendingAssignments.length === 0}
              onClick={() => handleBulk("REJECTED")}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50"
            >
              Rechazar pendientes
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-sm text-slate-700">
                <th className="px-4 py-3">Profesional</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Nota admin</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const edit = edits[a.professional.id] || {};

                return (
                  <tr key={a.professional.id} className="border-t border-slate-200 text-sm align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{a.professional.user?.name}</div>
                      <div className="text-xs text-slate-500">{a.professional.specialty}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusBadge(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={edit.adminReviewNote}
                        onChange={(e) => setField(a.professional.id, "adminReviewNote", e.target.value)}
                        placeholder="Comentario"
                        className="w-full min-w-[160px] rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isPending || fiscalIncompleto}
                          title={fiscalIncompleto ? "Clasifique el servicio antes de aprobar" : undefined}
                          onClick={() => handleReview(a.professional.id, "APPROVED")}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                        >
                          Aprobar / editar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleReview(a.professional.id, "REJECTED")}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </>
  );
}
