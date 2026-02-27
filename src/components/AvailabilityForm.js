// src/components/AvailabilityForm.js
"use client";

import { useMemo, useState } from "react";
import { updateAvailability } from "@/actions/availability-actions";

const DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

function buildTimes() {
  const times = [];
  for (let i = 6; i < 23; i++) {
    const h = i < 10 ? `0${i}` : String(i);
    times.push(`${h}:00`);
    times.push(`${h}:30`);
  }
  return times;
}
const TIMES = buildTimes();

function addMinutes(time, minutes) {
  const [hh, mm] = time.split(":").map((x) => parseInt(x, 10));
  const total = hh * 60 + mm + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  const H = nh < 10 ? `0${nh}` : String(nh);
  const M = nm < 10 ? `0${nm}` : String(nm);
  return `${H}:${M}`;
}

export default function AvailabilityForm({ initialData = [] }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }

  const [schedule, setSchedule] = useState(() => {
    const map = {};
    for (const d of DAYS) {
      map[d.id] = (initialData || [])
        .filter((it) => it.dayOfWeek === d.id)
        .map((it) => ({ start: it.startTime, end: it.endTime }))
        .sort((a, b) => a.start.localeCompare(b.start));
    }
    return map;
  });

  const hasInvalidBlocks = useMemo(() => {
    for (const dayId of Object.keys(schedule)) {
      for (const b of schedule[dayId]) {
        if (!b?.start || !b?.end) return true;
        if (b.start >= b.end) return true;
      }
    }
    return false;
  }, [schedule]);

  const addBlock = (dayId) => {
    setMsg(null);
    setSchedule((prev) => {
      const blocks = [...(prev[dayId] || [])];
      const last = blocks[blocks.length - 1];

      let start = "09:00";
      let end = "13:00";

      if (last?.end && TIMES.includes(last.end)) {
        start = last.end;
        const candidate = addMinutes(start, 60);
        end = TIMES.includes(candidate) ? candidate : addMinutes(start, 30);
      }

      // Evitar duplicado exacto por defecto
      const key = `${start}|${end}`;
      const exists = blocks.some((b) => `${b.start}|${b.end}` === key);
      blocks.push(exists ? { start: "14:00", end: "18:00" } : { start, end });

      return { ...prev, [dayId]: blocks };
    });
  };

  const removeBlock = (dayId, index) => {
    setMsg(null);
    setSchedule((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).filter((_, i) => i !== index),
    }));
  };

  const updateBlock = (dayId, index, field, value) => {
    setMsg(null);
    setSchedule((prev) => {
      const blocks = [...(prev[dayId] || [])];
      blocks[index] = { ...blocks[index], [field]: value };
      blocks.sort((a, b) => a.start.localeCompare(b.start));
      return { ...prev, [dayId]: blocks };
    });
  };

  const handleSubmit = async () => {
    setMsg(null);
    setLoading(true);

    try {
      if (hasInvalidBlocks) {
        setMsg({
          type: "error",
          text: "Tenés bloques inválidos: la hora fin debe ser mayor que la hora inicio.",
        });
        return;
      }

      const payload = [];
      for (const dayId of Object.keys(schedule)) {
        for (const block of schedule[dayId]) {
          payload.push({
            dayOfWeek: Number(dayId),
            startTime: block.start,
            endTime: block.end,
          });
        }
      }

      const result = await updateAvailability(payload);
      if (result?.success) {
        setMsg({ type: "success", text: "✅ Horarios guardados con éxito." });
      } else {
        const details = result?.details ? ` Detalle: ${result.details}` : "";
        setMsg({ type: "error", text: `❌ ${result?.error || "Error al guardar."}${details}` });
      }
    } catch (e) {
      setMsg({ type: "error", text: `❌ Error inesperado: ${String(e?.message ?? e)}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Definir turnos de trabajo</h3>
        <p className="text-sm text-slate-500 mt-1">
          Tip: podés agregar múltiples turnos por día (ej: mañana y tarde). Todas las horas se guardan en hora de Costa Rica.
        </p>
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-4">
        {DAYS.map((day) => {
          const blocks = schedule[day.id] || [];
          return (
            <div key={day.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-800">
                  {day.label}{" "}
                  {blocks.length === 0 && (
                    <span className="ml-2 text-xs font-medium text-slate-500">(No laborable)</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => addBlock(day.id)}
                  className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-medium transition-colors"
                >
                  + Agregar bloque
                </button>
              </div>

              {blocks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {blocks.map((block, index) => (
                    <div
                      key={`${day.id}-${index}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                    >
                      <select
                        value={block.start}
                        onChange={(e) => updateBlock(day.id, index, "start", e.target.value)}
                        className="rounded-lg border-slate-300 bg-white text-sm py-2"
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <span className="text-slate-400 text-sm">➜</span>

                      <select
                        value={block.end}
                        onChange={(e) => updateBlock(day.id, index, "end", e.target.value)}
                        className="rounded-lg border-slate-300 bg-white text-sm py-2"
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeBlock(day.id, index)}
                        className="ml-auto text-xs font-semibold text-slate-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50"
                        title="Eliminar este turno"
                      >
                        Quitar
                      </button>

                      {block.start >= block.end && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                          ⚠️ Hora inválida
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-xl bg-blue-600 text-white px-5 py-2.5 font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar todos los horarios"}
        </button>
      </div>
    </div>
  );
}
