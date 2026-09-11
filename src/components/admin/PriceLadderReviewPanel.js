"use client";

// Revisión de las escaleras de precio que proponen los profesionales. El admin
// aprueba o rechaza una propuesta, y puede terminar una escalera vigente.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endPriceLadder, reviewPriceLadder } from "@/actions/price-ladder-actions";
import { formatCRC as formatCRCBase } from "@/lib/service-pricing";
import PriceLadderTiersTable from "@/components/pricing/PriceLadderTiersTable";

// Formato compartido; este componente muestra "—" cuando no hay monto.
const formatCRC = (value) => formatCRCBase(value, { vacio: "—" });

export default function PriceLadderReviewPanel({ escaleras = [] }) {
  const router = useRouter();
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const correr = (accion, textoOk) => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await accion();
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: textoOk });
      router.refresh();
    });
  };

  if (escaleras.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        No hay escaleras de precio pendientes ni vigentes.
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

      {escaleras.map((escalera) => {
        const pendiente = escalera.status === "PENDING";
        const nota = notes[escalera.id] ?? "";

        return (
          <div key={escalera.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{escalera.professionalName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-700">{escalera.serviceTitle}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Precio general aprobado: {formatCRC(escalera.precioGeneral)} · rige para pacientes que ya atiende y
                  cuando la escalera se completa.
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  pendiente ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {pendiente ? "Pendiente" : "Vigente"}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <PriceLadderTiersTable escalera={escalera} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="text-sm">
                <span className="font-medium text-slate-800">Nota para el profesional</span>
                <input
                  type="text"
                  value={nota}
                  onChange={(event) => setNotes((previas) => ({ ...previas, [escalera.id]: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>

              <div className="flex items-end gap-2">
                {pendiente ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        correr(
                          () => reviewPriceLadder(escalera.id, "APPROVED", { note: nota }),
                          "Escalera aprobada: ya rige para pacientes nuevos."
                        )
                      }
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        correr(() => reviewPriceLadder(escalera.id, "REJECTED", { note: nota }), "Escalera rechazada.")
                      }
                      className="rounded-xl border border-rose-200 px-4 py-2.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      correr(
                        () => endPriceLadder(escalera.id, { note: nota }),
                        "Escalera terminada: los pacientes nuevos pagan la tarifa general."
                      )
                    }
                    className="rounded-xl border border-rose-200 px-4 py-2.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Terminar escalera
                  </button>
                )}
              </div>
            </div>

            {pendiente && (
              <p className="mt-2 text-xs text-slate-500">
                Al aprobarla se cierra la escalera vigente de esa consulta, si la hay. Quienes entraron en la anterior
                conservan su precio.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
