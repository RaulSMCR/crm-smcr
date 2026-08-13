"use client";

// Revisión de las tarifas propuestas por los profesionales. El admin puede
// aprobar el monto propuesto, aprobar otro distinto (negociación) o rechazar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewRate, bulkApproveRates } from "@/actions/rate-review-actions";
import { modalityLabel } from "@/lib/rates";

function formatCRC(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(
    Number(value)
  );
}

function scopeLabel(rate) {
  const place = rate.location ? `${rate.location.name} (${modalityLabel(rate.location.modality)})` : "Cualquier lugar";
  const band = rate.timeBand ? `${rate.timeBand.name} ${rate.timeBand.startTime}-${rate.timeBand.endTime}` : "Cualquier franja";
  return `${place} · ${band}`;
}

export default function RateReviewPanel({ rates = [], status = "PENDING" }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set());
  const [overrides, setOverrides] = useState({});
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const decide = (rate, decision) => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await reviewRate(rate.id, decision, {
        note: notes[rate.id] || "",
        overridePrice: overrides[rate.id] ?? null,
      });

      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({
        type: "ok",
        text: decision === "APPROVED" ? `Tarifa aprobada en ${formatCRC(res.approvedPrice)}.` : "Tarifa rechazada.",
      });
      router.refresh();
    });
  };

  const approveSelected = () => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await bulkApproveRates([...selected]);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setSelected(new Set());
      setMsg({
        type: "ok",
        text: `${res.approved} tarifa(s) aprobadas${res.skipped ? `, ${res.skipped} omitidas por no tener precio propuesto` : ""}.`,
      });
      router.refresh();
    });
  };

  if (rates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        No hay tarifas {status === "PENDING" ? "pendientes de revisión" : "en este estado"}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg.text && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      {status === "PENDING" && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-900">{selected.size} seleccionada(s)</span>
          <button
            type="button"
            onClick={approveSelected}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Aprobar al precio propuesto
          </button>
        </div>
      )}

      {rates.map((rate) => (
        <div key={rate.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {status === "PENDING" && (
                  <input
                    type="checkbox"
                    checked={selected.has(rate.id)}
                    onChange={() => toggle(rate.id)}
                    className="h-4 w-4"
                  />
                )}
                <span className="font-semibold text-slate-900">
                  {rate.assignment?.professional?.user?.name || "Profesional"}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700">{rate.assignment?.service?.title}</span>
              </div>
              <div className="mt-1 text-sm text-slate-600">{scopeLabel(rate)}</div>
            </div>

            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Propuesto</div>
              <div className="text-xl font-bold text-slate-900">{formatCRC(rate.proposedPrice)}</div>
              {rate.approvedPrice !== null && (
                <div className="text-xs text-slate-500">Vigente: {formatCRC(rate.approvedPrice)}</div>
              )}
            </div>
          </div>

          {status === "PENDING" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto]">
              <label className="text-sm">
                <span className="font-medium text-slate-800">Aprobar otro monto</span>
                <input
                  type="number"
                  min="1"
                  step="500"
                  value={overrides[rate.id] ?? ""}
                  onChange={(e) => setOverrides((prev) => ({ ...prev, [rate.id]: e.target.value }))}
                  placeholder={String(rate.proposedPrice ?? "")}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="text-sm">
                <span className="font-medium text-slate-800">Nota para el profesional</span>
                <input
                  type="text"
                  value={notes[rate.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [rate.id]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => decide(rate, "APPROVED")}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => decide(rate, "REJECTED")}
                  className="rounded-xl border border-rose-200 px-4 py-2.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {rate.adminReviewNote && status !== "PENDING" && (
            <div className="mt-3 text-sm text-slate-600">Nota: {rate.adminReviewNote}</div>
          )}
        </div>
      ))}
    </div>
  );
}
