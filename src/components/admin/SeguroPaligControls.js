"use client";

// Controles de Admin → Seguros para marcar o quitar el seguro PALIG de un
// paciente sin esperar a que lo declare él desde su perfil.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { marcarSeguroPaligAction, quitarSeguroAction } from "@/actions/seguro-palig-actions";

/** Elegir un paciente sin seguro y marcarlo como PALIG. */
export function MarcarPacientePalig({ pacientes = [] }) {
  const [patientId, setPatientId] = useState("");
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();
  const router = useRouter();

  function marcar() {
    const nombre = pacientes.find((p) => p.id === patientId)?.name || "El paciente";
    startTransition(async () => {
      const r = await marcarSeguroPaligAction(patientId);
      if (!r?.success) {
        avisar(r?.error || "No se pudo marcar el seguro.", "error");
        return;
      }
      avisar(`${nombre} quedó registrado con seguro PALIG.`, "success");
      setPatientId("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-600">
        Para pacientes que ya se atienden con seguro PALIG y no lo indicaron en su perfil. Así aparecen en el piloto PALIG.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[16rem] flex-1 text-sm font-medium text-slate-800">
          Paciente
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Seleccione el paciente</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.email}</option>
            ))}
          </select>
        </label>
        <button
          onClick={marcar}
          disabled={!patientId || isPending}
          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? "Guardando…" : "Marcar con seguro PALIG"}
        </button>
      </div>
    </div>
  );
}

/** Deshacer la marca de un paciente (los documentos cargados se conservan). */
export function QuitarSeguro({ patientId, patientName }) {
  const [confirmando, setConfirmando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();
  const router = useRouter();

  function quitar() {
    startTransition(async () => {
      const r = await quitarSeguroAction(patientId);
      if (!r?.success) {
        avisar(r?.error || "No se pudo quitar el seguro.", "error");
        return;
      }
      avisar(`${patientName} ya no figura con seguro. Sus documentos se conservan.`, "success");
      setConfirmando(false);
      router.refresh();
    });
  }

  if (!confirmando) {
    return (
      <button onClick={() => setConfirmando(true)} className="text-xs font-semibold text-slate-500 hover:text-red-700 hover:underline">
        Quitar seguro
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-slate-600">¿Quitar el seguro de {patientName}?</span>
      <button onClick={quitar} disabled={isPending} className="font-semibold text-red-700 hover:underline disabled:opacity-50">
        {isPending ? "Quitando…" : "Sí, quitar"}
      </button>
      <button onClick={() => setConfirmando(false)} className="font-semibold text-slate-600 hover:underline">
        No
      </button>
    </span>
  );
}
