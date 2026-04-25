"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkReviewServiceAssignments,
  reviewServiceAssignment,
  updateAssignmentOnvoLink,
} from "@/actions/service-actions";
import Toast from "@/components/ui/Toast";

function statusBadge(status) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default function ServiceAssignmentsReviewPanel({ serviceId, assignments }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);

  const [edits, setEdits] = useState(() => {
    const base = {};
    for (const a of assignments) {
      base[a.professional.id] = {
        approvedSessionPrice: a.proposedSessionPrice ?? "",
        adminReviewNote: a.adminReviewNote ?? "",
      };
    }
    return base;
  });

  const [onvoLinks, setOnvoLinks] = useState(() => {
    const base = {};
    for (const a of assignments) {
      base[a.professional.id] = a.onvoPaymentLinkId ?? "";
    }
    return base;
  });

  const [savingOnvo, setSavingOnvo] = useState({});

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
      const res = await reviewServiceAssignment(serviceId, professionalId, { ...payload, decision });
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
      approvedSessionPrice: edits[a.professional.id]?.approvedSessionPrice,
      adminReviewNote: edits[a.professional.id]?.adminReviewNote,
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

  const handleSaveOnvo = async (professionalId) => {
    setToast(null);
    setSavingOnvo((prev) => ({ ...prev, [professionalId]: true }));
    const res = await updateAssignmentOnvoLink(professionalId, serviceId, onvoLinks[professionalId]);
    setSavingOnvo((prev) => ({ ...prev, [professionalId]: false }));
    if (res?.success) {
      setToast({ message: "Enlace ONVO actualizado.", type: "success" });
    } else {
      setToast({ message: res?.error || "No se pudo guardar el enlace ONVO.", type: "error" });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Pendientes: <b>{pendingAssignments.length}</b>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || pendingAssignments.length === 0}
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
                <th className="px-4 py-3">Monto propuesto</th>
                <th className="px-4 py-3">Monto aprobado</th>
                <th className="px-4 py-3">Nota admin</th>
                <th className="px-4 py-3">Enlace ONVO</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const edit = edits[a.professional.id] || {};
                const onvoVal = onvoLinks[a.professional.id] ?? "";
                const hasOnvo = !!onvoVal.trim();
                const isSaving = savingOnvo[a.professional.id];

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
                    <td className="px-4 py-3">₡{a.proposedSessionPrice ?? "-"}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={edit.approvedSessionPrice}
                        onChange={(e) => setField(a.professional.id, "approvedSessionPrice", e.target.value)}
                        className="w-32 rounded-lg border border-slate-300 px-2 py-1"
                      />
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
                      <div className="flex items-center gap-2 min-w-[220px]">
                        <span
                          title={hasOnvo ? "Enlace configurado" : "Sin enlace"}
                          className={`h-2 w-2 shrink-0 rounded-full ${hasOnvo ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                        <input
                          value={onvoVal}
                          onChange={(e) =>
                            setOnvoLinks((prev) => ({ ...prev, [a.professional.id]: e.target.value }))
                          }
                          placeholder="live_xxxxxxxxxxxxxxxx"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs"
                        />
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveOnvo(a.professional.id)}
                          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {isSaving ? "…" : "Guardar"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isPending}
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
