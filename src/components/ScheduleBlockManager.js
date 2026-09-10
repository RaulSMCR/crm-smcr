// src/components/ScheduleBlockManager.js
"use client";

import { useState, useTransition } from "react";
import {
  createScheduleBlock,
  deleteScheduleBlock,
  listScheduleBlocks,
} from "@/actions/schedule-block-actions";

const TZ = "America/Costa_Rica";
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** El "hoy" de Costa Rica como YYYY-MM-DD, para no dejar elegir ayer. */
function hoyCR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diaLargo(date) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function hora(date) {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function rotulo(startISO, endISO) {
  const inicio = new Date(startISO);
  const fin = new Date(endISO);

  // Un bloqueo de día completo se guarda como 00:00 al 00:00 del día siguiente.
  // Mostrarlo como "de 12:00 a.m. a 12:00 a.m." sería exacto y desconcertante,
  // así que se rotula por los días que cubre. Se resta un milisegundo al fin
  // para nombrar el último día incluido y no el siguiente.
  if (fin.getTime() - inicio.getTime() >= UN_DIA_MS) {
    const primero = diaLargo(inicio);
    const ultimo = diaLargo(new Date(fin.getTime() - 1));
    return primero === ultimo ? `${primero}, todo el día` : `De ${primero} a ${ultimo}`;
  }

  return `${diaLargo(inicio)}, de ${hora(inicio)} a ${hora(fin)}`;
}

export default function ScheduleBlockManager({ initialBlocks = [] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await createScheduleBlock({ date, startTime, endTime, allDay, reason });

      if (!result?.success) {
        setFeedback({ tone: "error", text: result?.error || "No se pudo guardar el bloqueo." });
        return;
      }

      // Se relee del servidor en vez de insertar el bloqueo a mano: así la lista
      // muestra lo que quedó guardado y no una versión optimista que podría no
      // coincidir con la normalización de horas del servidor.
      const refreshed = await listScheduleBlocks();
      if (refreshed?.success) setBlocks(refreshed.data);

      setDate("");
      setReason("");
      setFeedback({ tone: "ok", text: "Horas bloqueadas. Ya no se ofrecen para agendar." });
    });
  }

  function handleDelete(id) {
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteScheduleBlock(id);
      if (!result?.success) {
        setFeedback({ tone: "error", text: result?.error || "No se pudo eliminar." });
        return;
      }
      setBlocks((current) => current.filter((block) => block.id !== id));
      setFeedback({ tone: "ok", text: "Bloqueo eliminado. Esas horas vuelven a ofrecerse." });
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Bloquear horas</h2>
        <p className="mt-1 text-sm text-slate-600">
          Para vacaciones, un viaje o cualquier rato en que no vaya a atender. Lo que bloquee deja de
          ofrecerse de inmediato y nadie puede agendar ahí. Sus horarios de siempre quedan intactos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              type="date"
              required
              min={hoyCR()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Motivo (opcional)</span>
            <input
              type="text"
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Vacaciones, congreso, asunto personal…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Solo lo ve usted. El paciente nunca sabe el motivo.
            </span>
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Todo el día</span>
        </label>

        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Desde</span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Hasta</span>
              <input
                type="time"
                required
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !date}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Bloquear estas horas"}
        </button>
      </form>

      {feedback && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700">Bloqueos vigentes</h3>
        {blocks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No tiene horas bloqueadas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {rotulo(block.startISO, block.endISO)}
                  </p>
                  {block.reason ? (
                    <p className="truncate text-xs text-slate-500">{block.reason}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(block.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
