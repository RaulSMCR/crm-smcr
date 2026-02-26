"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkReviewServiceAssignments, reviewServiceAssignment } from "@/actions/service-actions";

function statusBadge(status) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default function ServiceAssignmentsReviewPanel({ serviceId, assignments }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [edits, setEdits] = useState(() => {
    const base = {};
    for (const a of assignments) {
      base[a.professional.id] = {
        approvedSessionPrice: a.approvedSessionPrice ?? a.proposedSessionPrice ?? "",
        adminReviewNote: a.adminReviewNote ?? "",
      };
    }
    return base;
  });

  const pendingAssignments = useMemo(
    () => assignments.filter((a) => a.status === "PENDING"),
    [assignments]
  );

  const setField = (professionalId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [professionalId]: {
        ...(prev[professionalId] || {}),
        [field]: value,
      },
    }));
  };

  const handleReview = (professionalId, decision) => {
    setMessage("");
    const payload = edits[professionalId] || {};

    startTransition(async () => {
      const res = await reviewServiceAssignment(serviceId, professionalId, { ...payload, decision });
      if (res?.success) {
        setMessage("Solicitud actualizada correctamente.");
        router.refresh();
      } else {
        setMessage(res?.error || "No se pudo actualizar la solicitud.");
      }
    });
  };

  const handleBulk = (decision) => {
    if (pendingAssignments.length === 0) return;
    setMessage("");

    const updates = pendingAssignments.map((a) => ({
      professionalId: a.professional.id,
      decision,
      approvedSessionPrice: edits[a.professional.id]?.approvedSessionPrice,
      adminReviewNote: edits[a.professional.id]?.adminReviewNote,
    }));

    startTransition(async () => {
      const res = await bulkReviewServiceAssignments(serviceId, updates);
      if (res?.success) {
        setMessage(
          decision === "APPROVED"
            ? "Se aprobaron las solicitudes pendientes."
            : "Se rechazaron las solicitudes pendientes."
        );
        router.refresh();
      } else {
        setMessage(res?.error || "No se pudo ejecutar la revisión masiva.");
      }
    });
  };

  return (
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

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-sm text-slate-700">
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Estado solicitud</th>
              <th className="px-4 py-3">Monto propuesto</th>
              <th className="px-4 py-3">Monto aprobado</th>
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
                    <div className="text-xs text-slate-600">{a.professional.specialty}</div>
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
                      className="w-full min-w-[180px] rounded-lg border border-slate-300 px-2 py-1"
                    />
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
  );
}
