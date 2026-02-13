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

const TIMES = [];
for (let i = 6; i < 23; i++) {
  const hour = i < 10 ? `0${i}` : String(i);
  TIMES.push(`${hour}:00`);
  TIMES.push(`${hour}:30`);
}

export default function AvailabilityForm({ initialData = [] }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "success"|"error", text: string }

  const [schedule, setSchedule] = useState(() => {
    const map = {};
    DAYS.forEach((d) => {
      const dayBlocks = initialData
        .filter((item) => item.dayOfWeek === d.id)
        .map((item) => ({ start: item.startTime, end: item.endTime }));
      map[d.id] = dayBlocks;
    });
    return map;
  });

  const addBlock = (dayId) => {
    setMsg(null);
    setSchedule((prev) => ({
      ...prev,
      [dayId]: [...prev[dayId], { start: "09:00", end: "13:00" }],
    }));
  };

  const removeBlock = (dayId, index) => {
    setMsg(null);
    setSchedule((prev) => ({
      ...prev,
      [dayId]: prev[dayId].filter((_, i) => i !== index),
    }));
  };

  const updateBlock = (dayId, index, field, value) => {
    setMsg(null);
    setSchedule((prev) => {
      const newBlocks = [...prev[dayId]];
      newBlocks[index] = { ...newBlocks[index], [field]: value };
      return { ...prev, [dayId]: newBlocks };
    });
  };

  const hasInvalidBlocks = useMemo(() => {
    for (const dayId of Object.keys(schedule)) {
      for (const b of schedule[dayId]) {
        if (!b?.start || !b?.end) return true;
        if (b.start >= b.end) return true;
      }
    }
    return false;
  }, [schedule]);

  const handleSubmit = async () => {
    setMsg(null);
    setLoading(true);

    try {
      if (hasInvalidBlocks) {
        setMsg({ type: "error", text: "Tenés bloques inválidos: la hora fin debe ser mayor que la hora inicio." });
        setLoading(false);
        return;
      }

      const payload = [];
      Object.keys(schedule).forEach((dayId) => {
        schedule[dayId].forEach((block) => {
          payload.push({
            dayOfWeek: Number(dayId),
            startTime: block.start,
            endTime: block.end,
          });
        });
      });

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
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800">Definir Turnos de Trabajo</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Tip: Puedes agregar múltiples turnos por día (ej: mañana y tarde)
        </span>
      </div>

      {msg && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium border ${
            msg.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-6">
        {DAYS.map((day) => {
          const blocks = schedule[day.id];
          const hasBlocks = blocks.length > 0;

          return (
            <div
              key={day.id}
              className={`p-4 rounded-xl border transition-colors ${
                hasBlocks ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-lg ${hasBlocks ? "text-gray-800" : "text-gray-400"}`}>
                    {day.label}
                  </span>
                  {!hasBlocks && <span className="text-xs text-gray-400 italic">(No laborable)</span>}
                </div>

                <button
                  type="button"
                  onClick={() => addBlock(day.id)}
                  className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-medium transition-colors"
                >
                  + Agregar Bloque
                </button>
              </div>

              <div className="space-y-2">
                {blocks.map((block, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <select
                        value={block.start}
                        onChange={(e) => updateBlock(day.id, index, "start", e.target.value)}
                        className="bg-transparent text-sm border-none p-0 focus:ring-0 text-gray-700 font-medium cursor-pointer"
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <span className="text-gray-400">➜</span>

                      <select
                        value={block.end}
                        onChange={(e) => updateBlock(day.id, index, "end", e.target.value)}
                        className="bg-transparent text-sm border-none p-0 focus:ring-0 text-gray-700 font-medium cursor-pointer"
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBlock(day.id, index)}
                      className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                      title="Eliminar este turno"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {block.start >= block.end && (
                      <span className="text-xs text-red-500 font-medium">⚠️ Hora inválida</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || hasInvalidBlocks}
          className="bg-gray-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-black transition-transform active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-900/10"
          title={hasInvalidBlocks ? "Corrige los bloques inválidos antes de guardar." : ""}
        >
          {loading ? "Guardando..." : "Guardar Todos los Horarios"}
        </button>
      </div>
    </div>
  );
}
