// src/components/ScheduleOverview.js
"use client";

import { useEffect, useState, useTransition } from "react";
import { getScheduleOverview } from "@/actions/schedule-block-actions";

/**
 * La semana del profesional, dibujada.
 *
 * Muestra juntas las capas que deciden si un rato está libre. Verlas separadas
 * —la franja en un formulario, las citas en otra pantalla, lo demás en Google—
 * es lo que produce sorpresas al agendar.
 *
 * Todo va en hora de Costa Rica, que es la zona en la que el profesional declara
 * su disponibilidad, aunque él esté en otro huso.
 */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/**
 * Alto por hora, en píxeles.
 *
 * Antes la grilla medía 420px fijos: con un rango de dieciséis horas, una cita
 * de una hora quedaba en 26px y no entraba ni la hora. Ahora la altura sale del
 * rango, así que una banda de una hora siempre mide lo mismo y siempre se lee.
 */
const ALTO_POR_HORA = 46;

/**
 * Paleta categórica validada con el script de la guía de visualización
 * (bandas de luminosidad, piso de croma, separación para daltonismo y contraste).
 * No cambiar un hex sin volver a correrlo: el peor par para deuteranopía queda
 * en ΔE 9.2, apenas sobre el umbral de 8.
 *
 * Cada banda se pinta como tinte claro con una barra del color pleno a la
 * izquierda, y el texto va en tinta oscura. Es lo que permite que la etiqueta se
 * lea siempre: sobre relleno pleno, el turquesa no da contraste con texto blanco.
 */
const ESTILOS = {
  cita: {
    color: "#2a78d6",
    fondo: "rgba(42, 120, 214, 0.13)",
    rotulo: "Cita del sistema",
  },
  bloqueo: {
    color: "#eb6834",
    fondo: "rgba(235, 104, 52, 0.14)",
    rotulo: "Bloqueo que usted creó",
  },
  google: {
    color: "#1baf7a",
    fondo: "rgba(27, 175, 122, 0.15)",
    rotulo: "Ocupado en su Google Calendar",
  },
};

/** El feriado es estado, no serie: color reservado y siempre con ícono y texto. */
const COLOR_AVISO = "#fab219";

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
  const [detalle, setDetalle] = useState(null);
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

  useEffect(() => {
    setDetalle(null);
  }, [offset]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        {error || "Cargando su agenda..."}
      </div>
    );
  }

  const { days, gridStartMin, gridEndMin, googleConectado } = data;
  const total = gridEndMin - gridStartMin;
  const alto = Math.round((total / 60) * ALTO_POR_HORA);

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

      {/* La identidad nunca queda solo en el color: cada tipo se nombra acá y
          además cada banda lleva su etiqueta encima. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-slate-300 bg-white" />
          Franja declarada, libre
        </span>
        {Object.values(ESTILOS).map((estilo) => (
          <span key={estilo.rotulo} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: estilo.color }} />
            {estilo.rotulo}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold text-slate-900"
            style={{ background: COLOR_AVISO }}
          >
            !
          </span>
          Feriado — avisa, no bloquea
        </span>
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

      <div className="overflow-x-auto">
        <div className={`min-w-[720px] ${isPending ? "opacity-60" : ""}`}>
          <div className="flex">
            <div className="w-12 shrink-0 pt-12">
              <div className="relative" style={{ height: alto }}>
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

            {days.map((dia) => {
              const feriados = dia.busy.filter((b) => b.kind === "aviso");
              const ocupado = dia.busy.filter((b) => b.kind !== "aviso");

              return (
                <div key={dia.ymd} className="min-w-0 flex-1 px-0.5">
                  <div
                    className={`text-center text-xs font-semibold ${
                      dia.isToday ? "text-blue-700" : "text-slate-600"
                    }`}
                  >
                    {DIAS[dia.dayOfWeek]} {numeroDeDia(dia.ymd)}
                  </div>

                  {/* El feriado es una propiedad del día entero, no de unas horas:
                      va en el encabezado y no como banda, que era lo que lo hacía
                      competir visualmente con lo que sí ocupa la agenda. */}
                  <div className="flex h-8 items-start justify-center pt-1">
                    {feriados.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDetalle({ ...feriados[0], ymd: dia.ymd })}
                        title={feriados.map((f) => f.label).join(" · ")}
                        className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-900"
                        style={{ background: COLOR_AVISO }}
                      >
                        <span aria-hidden="true">!</span>
                        <span className="truncate">Feriado</span>
                      </button>
                    )}
                  </div>

                  <div
                    className={`relative overflow-hidden rounded-lg border ${
                      dia.isToday ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-slate-50/60"
                    }`}
                    style={{ height: alto }}
                  >
                    {horas.map((m) => (
                      <div
                        key={m}
                        className="absolute inset-x-0 border-t border-slate-200/70"
                        style={{ top: `${pos(m)}%` }}
                      />
                    ))}

                    {dia.available.map((franja, i) => (
                      <div
                        key={`disp-${i}`}
                        className="absolute inset-x-0 border-y border-slate-300/60 bg-white"
                        style={{
                          top: `${pos(franja.startMin)}%`,
                          height: `${((franja.endMin - franja.startMin) / total) * 100}%`,
                        }}
                      />
                    ))}

                    {ocupado.map((banda, i) => {
                      const estilo = ESTILOS[banda.kind] || ESTILOS.bloqueo;
                      const altoPx = ((banda.endMin - banda.startMin) / 60) * ALTO_POR_HORA;
                      const activo =
                        detalle?.ymd === dia.ymd &&
                        detalle?.startMin === banda.startMin &&
                        detalle?.label === banda.label;

                      return (
                        <button
                          key={`ocu-${i}`}
                          type="button"
                          onClick={() => setDetalle({ ...banda, ymd: dia.ymd })}
                          title={`${hhmm(banda.startMin)}–${hhmm(banda.endMin)} · ${banda.label} · ${estilo.rotulo}`}
                          className={`absolute inset-x-0.5 overflow-hidden rounded-r px-1 text-left leading-tight ${
                            activo ? "ring-2 ring-slate-900 ring-offset-1" : ""
                          }`}
                          style={{
                            top: `${pos(banda.startMin)}%`,
                            height: `${((banda.endMin - banda.startMin) / total) * 100}%`,
                            background: estilo.fondo,
                            borderLeft: `3px solid ${estilo.color}`,
                          }}
                        >
                          <span className="block truncate text-[10px] font-semibold text-slate-900">
                            {hhmm(banda.startMin)}
                          </span>
                          {altoPx > 30 && (
                            <span className="block truncate text-[10px] text-slate-700">
                              {banda.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* El detalle al hacer clic reemplaza al tooltip del navegador, que tardaba
          un segundo en aparecer, no funcionaba en móvil y a veces no salía. */}
      {detalle ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{detalle.label}</p>
              <p className="mt-0.5 text-slate-600">
                {detalle.kind === "aviso"
                  ? "Feriado. El horario sigue disponible y usted puede atender; al paciente se le avisa antes de confirmar."
                  : `${hhmm(detalle.startMin)} a ${hhmm(detalle.endMin)}, hora de Costa Rica · ${
                      (ESTILOS[detalle.kind] || {}).rotulo || ""
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetalle(null)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          El blanco es la franja que usted declaró y está libre.{" "}
          <strong className="font-semibold text-slate-600">Toque cualquier bloque</strong> para ver
          el detalle.
        </p>
      )}
    </div>
  );
}
