// src/components/ScheduleOverview.js
"use client";

import { useEffect, useState, useTransition } from "react";
import { getScheduleOverview } from "@/actions/schedule-block-actions";

/**
 * La semana del profesional, dibujada.
 *
 * Muestra juntas las cuatro capas que deciden si un rato está libre. Verlas
 * separadas —la franja en un formulario, las citas en otra pantalla, lo demás en
 * Google— es lo que produce sorpresas al agendar.
 *
 * Todo va en hora de Costa Rica, que es la zona en la que el profesional declara
 * su disponibilidad, aunque él esté en otro huso.
 */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const ESTILOS = {
  cita: {
    caja: "bg-blue-600/85 border-blue-700 text-white",
    punto: "bg-blue-600",
    rotulo: "Cita del sistema",
  },
  bloqueo: {
    caja: "bg-amber-400/85 border-amber-500 text-amber-950",
    punto: "bg-amber-400",
    rotulo: "Bloqueo que usted creó",
  },
  google: {
    caja: "bg-violet-500/80 border-violet-600 text-white",
    punto: "bg-violet-500",
    rotulo: "Ocupado en su Google Calendar",
  },
};

function hhmm(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function numeroDeDia(ymd) {
  return Number(ymd.split("-")[2]);
}

export default function ScheduleOverview({ initialData = null }) {
  const [data, setData] = useState(initialData);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // La primera semana llega renderizada desde el servidor; solo se pide de
    // nuevo al navegar, para no repetir la consulta a Google en la carga.
    if (offset === 0 && initialData) {
      setData(initialData);
      return;
    }

    startTransition(async () => {
      const result = await getScheduleOverview({ weekOffset: offset });
      if (result?.success) {
        setData(result.data);
        setError("");
      } else {
        setError(result?.error || "No se pudo cargar la agenda.");
      }
    });
  }, [offset, initialData]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {error || "Cargando su agenda..."}
      </div>
    );
  }

  const { days, gridStartMin, gridEndMin, googleConectado } = data;
  const total = gridEndMin - gridStartMin;

  // Una línea por hora en punto dentro del rango dibujado.
  const horas = [];
  for (let m = Math.ceil(gridStartMin / 60) * 60; m <= gridEndMin; m += 60) horas.push(m);

  const pos = (minutos) => ((minutos - gridStartMin) / total) * 100;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Su semana</h2>
          <p className="mt-1 text-sm text-slate-600">
            Todo lo que ocupa su agenda, en un solo lugar y en hora de Costa Rica. Lo que aparece
            pintado no se le ofrece a ningún paciente.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((v) => v - 1)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Anterior
          </button>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Hoy
            </button>
          )}
          <button
            type="button"
            onClick={() => setOffset((v) => v + 1)}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-slate-300 bg-slate-50" />
          Franja declarada
        </span>
        {Object.entries(ESTILOS).map(([kind, estilo]) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ${estilo.punto}`} />
            {estilo.rotulo}
          </span>
        ))}
      </div>

      {!googleConectado && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          Google Calendar no está conectado, así que esta vista no incluye lo que tenga agendado por
          fuera del sistema.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
      )}

      {/* La grilla scrollea sola en pantallas angostas en vez de romper la página. */}
      <div className="overflow-x-auto">
        <div className={`min-w-[640px] ${isPending ? "opacity-60" : ""}`}>
          <div className="flex">
            {/* Regla de horas */}
            <div className="w-14 shrink-0 pt-6">
              <div className="relative" style={{ height: 420 }}>
                {horas.map((m) => (
                  <span
                    key={m}
                    className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
                    style={{ top: `${pos(m)}%` }}
                  >
                    {hhmm(m)}
                  </span>
                ))}
              </div>
            </div>

            {days.map((dia) => (
              <div key={dia.ymd} className="min-w-0 flex-1 px-0.5">
                <div
                  className={`pb-1 text-center text-xs font-semibold ${
                    dia.isToday ? "text-blue-700" : "text-slate-600"
                  }`}
                >
                  {DIAS[dia.dayOfWeek]} {numeroDeDia(dia.ymd)}
                </div>

                <div
                  className={`relative overflow-hidden rounded-lg border ${
                    dia.isToday ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-slate-50/60"
                  }`}
                  style={{ height: 420 }}
                >
                  {horas.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-slate-200/70"
                      style={{ top: `${pos(m)}%` }}
                    />
                  ))}

                  {/* Franja declarada: el fondo sobre el que se pinta lo ocupado. */}
                  {dia.available.map((franja, i) => (
                    <div
                      key={`disp-${i}`}
                      className="absolute inset-x-0 border-y border-slate-300/70 bg-white"
                      style={{
                        top: `${pos(franja.startMin)}%`,
                        height: `${((franja.endMin - franja.startMin) / total) * 100}%`,
                      }}
                    />
                  ))}

                  {dia.busy.map((banda, i) => {
                    const estilo = ESTILOS[banda.kind] || ESTILOS.bloqueo;
                    const alto = ((banda.endMin - banda.startMin) / total) * 100;

                    return (
                      <div
                        key={`ocu-${i}`}
                        title={`${hhmm(banda.startMin)}–${hhmm(banda.endMin)} · ${banda.label} · ${estilo.rotulo}`}
                        className={`absolute inset-x-0.5 overflow-hidden rounded border px-1 ${estilo.caja}`}
                        style={{ top: `${pos(banda.startMin)}%`, height: `${alto}%` }}
                      >
                        {/* Debajo de cierta altura no entra texto y se vería como basura. */}
                        {alto > 6 && (
                          <span className="block truncate text-[10px] font-semibold leading-tight">
                            {hhmm(banda.startMin)} {banda.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        El blanco es la franja que usted declaró y está libre. Pase el cursor sobre cualquier bloque
        para ver el detalle.
      </p>
    </div>
  );
}
